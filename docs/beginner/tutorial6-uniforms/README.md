# Uniform buffers and a 3d camera

<!--
While all of our previous work has seemed to be in 2d, we've actually been working in 3d the entire time! That's part of the reason why our `Vertex` structure has `position` be an array of 3 floats instead of just 2. We can't really see the 3d-ness of our scene, because we're viewing things head on. We're going to change our point of view by creating a `Camera`.
-->
これまでやってきた作業はすべて2次元に見えましたが、実際にはずっと3次元で作業しています。理由の一つは `Vertex` 構造体の `position` に 3 つの float か代わりに 2 つの float を使っていたからです。そして正面からしか見ていないので、本当に 3次元 のようには見ることができません。`Camera` を作って視点を変えていきましょう。

## A perspective camera

<!--
This tutorial is more about learning to use wgpu and less about linear algebra, so I'm going to gloss over a lot of the math involved. There's plenty of reading material online if you're interested in what's going on under the hood. The first thing to know is that we need `cgmath = "0.17"` in our `Cargo.toml`.
-->
このチュートリアルは wgpu の使い方が多くを占め、線形代数についてもチョット触れます。なので、数学について説明していきます。これについては多くの文献がオンラインにあるので、説明の詳細に興味が出てきたらそちらを参照してください。最初にすることは `Cargo.toml` に `cgmath = "0.17"` を加えることです。

<!--
Now that we have a math library, let's put it to use! Create a `Camera` struct above the `State` struct.
-->
数学のライブラリを手に入れたので使い方を説明しましょう！`Camera` 構造体を `State` 構造体よりも上に追加しましょう。

```rust
struct Camera {
    eye: cgmath::Point3<f32>,
    target: cgmath::Point3<f32>,
    up: cgmath::Vector3<f32>,
    aspect: f32,
    fovy: f32,
    znear: f32,
    zfar: f32,
}

impl Camera {
    fn build_view_projection_matrix(&self) -> cgmath::Matrix4<f32> {
        // 1.
        let view = cgmath::Matrix4::look_at(self.eye, self.target, self.up);
        // 2.
        let proj = cgmath::perspective(cgmath::Deg(self.fovy), self.aspect, self.znear, self.zfar);

        // 3.
        return OPENGL_TO_WGPU_MATRIX * proj * view;
    }
}
```

<!--
The `build_view_projection_matrix` is where the magic happens.
1. The `view` matrix moves the world to be at the position and rotation of the camera. It's essentialy an inverse of whatever the transform matrix of the camera would be.
2. The `proj` matrix wraps the scene to give the effect of depth. Without this, objects up close would be the same size as objects far away.
3. The coordinate system in Wgpu is based on DirectX, and Metal's coordinate systems. That means that in [normalized device coordinates](https://github.com/gfx-rs/gfx/tree/master/src/backend/dx12#normalized-coordinates) the x axis and y axis are in the range of -1.0 to +1.0, and the z axis is 0.0 to +1.0. The `cgmath` crate (as well as most game math crates) are built for OpenGL's coordinate system. This matrix will scale and translate our scene from OpenGL's coordinate sytem to WGPU's. We'll define it as follows.
-->
`build_view_projection_matrix` では魔法のようなことが起きます。
1. `view` 行列はカメラの position(位置) と rotation(回転) によって世界の中を動きます。本質的にはカメラの逆変換行列です。
2. `proj` 行列はシーンの有効な奥行きをラップしたものです。これがなければオブジェクトは近くても遠くても同じ大きさになります。
3. wgpu の座標系は DirectX や Metal の座標系がベースになっています。これはX軸とY軸は -1.0 から 1.0 の範囲、Z軸は0.0から1.0の範囲で[デバイスの座標系をノーマライズする](https://github.com/gfx-rs/gfx/tree/master/src/backend/dx12#normalized-coordinates)ことを意味しています。`cgmath` crate (そして同様に多くのゲーム用数学 crate) は OpenGL の座標系をもとに作られています。この行列は OpenGL の座標系で設定されたシーンを wgpu の座標系に変換します。その定義は以下です。

```rust
#[rustfmt::skip]
pub const OPENGL_TO_WGPU_MATRIX: cgmath::Matrix4<f32> = cgmath::Matrix4::new(
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 0.5, 0.0,
    0.0, 0.0, 0.5, 1.0,
);
```

<!--
* Note: We don't explicitly **need** the `OPENGL_TO_WGPU_MATRIX`, but models centered on (0, 0, 0) will be halfway inside the clipping area. This is only an issue if you aren't using a camera matrix.
-->
* Note: 必ずしも `OPENGL_TO_WGPU_MATRIX` は必要なものではありませんが、モデルを (0, 0, 0) に置くと半分クリッピングエリアに入ってしまいます。これはカメラの行列を使わない場合にのみ問題になります。

<!--
Now let's add a `camera` field to `State`.
-->
では `State` に `camera` を追加しましょう。

```rust
struct State {
    // ...
    camera: Camera,
    // ...
}

async fn new(window: &Window) -> Self {
    // let diffuse_bind_group ...

    let camera = Camera {
        // position the camera one unit up and 2 units back
        // +z is out of the screen
        // カメラのポジションを 1 単位分上げて、2 単位分下げます。
        // Z 軸の Plus 方向はカメラの後方です。
        eye: (0.0, 1.0, 2.0).into(),
        // have it look at the origin
        // カメラは原点を見ます
        target: (0.0, 0.0, 0.0).into(),
        // which way is "up"
        // どの軸が上を表すか指定します。
        up: cgmath::Vector3::unit_y(),
        aspect: sc_desc.width as f32 / sc_desc.height as f32,
        fovy: 45.0,
        znear: 0.1,
        zfar: 100.0,
    };

    Self {
        // ...
        camera,
        // ...
    }
}
```

<!--
Now that we have our camera, and it can make us a view projection matrix, we need somewhere to put it. We also need some way of getting it into our shaders.
-->
これでカメラが手に入ったので、ビュープロジェクション行列を作ることができるので、それらをどこかに配置する必要があります。そしてまた、それを何らかの方法で shader から取得する必要があります。

## The uniform buffer

<!--
Up to this point we've used `Buffer`s to store our vertex and index data, and even to load our textures. We are going to use them again to create what's known as a uniform buffer. A uniform is a blob of data that is available to every invocation of a set of shaders. We've technically already used uniforms for our texture and sampler. We're going to use them again to store our view projection matrix. To start let's create a struct to hold our `Uniforms`.
-->
ここまでに保存している座標やインデックスのデータ、texture をロードするために `Buffer` を使いました。それを再び利用して、uniform buffer というものを作ります。uniform はどの sharder からでも呼び出すことができる blob data です。技術的にはすでに uniform を texture や sampler のために使っています。今度はビュープロジェクション行列を保存するために使います。`Uniforms` という構造体を作りましょう。

```rust
#[repr(C)] // We need this for Rust to store our data correctly for the shaders
           // sharder にデータを正確に保存するために必要です
#[derive(Debug, Copy, Clone)] // This is so we can store this in a buffer
                              // これを書くことでこの構造体を buffer に保存することができます
struct Uniforms {
    view_proj: cgmath::Matrix4<f32>,
}

impl Uniforms {
    fn new() -> Self {
        use cgmath::SquareMatrix;
        Self {
            view_proj: cgmath::Matrix4::identity(),
        }
    }

    fn update_view_proj(&mut self, camera: &Camera) {
        self.view_proj = camera.build_view_projection_matrix();
    }
}
```

<!--
Now that we have our data structured, let's make our `uniform_buffer`.
-->
データの構造はできたので `uniform_buffer` を作りましょう。

```rust
// in new() after creating `camera`

let mut uniforms = Uniforms::new();
uniforms.update_view_proj(&camera);

let uniform_buffer = device.create_buffer_with_data(
    bytemuck::cast_slice(&[uniforms]),
    wgpu::BufferUsage::UNIFORM | wgpu::BufferUsage::COPY_DST,
);
```

## Uniform buffers and bind groups

<!--
Cool, now that we have a uniform buffer, what do we do with it? The answer is we create a bind group for it. First we have to create the bind group layout.
-->
いいですね。 uniform buffer ができたのでこれを使って何をしましょうか。答えはこれの bind group を作るです。最初に bind group layout を作りましょう。

```rust
let uniform_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
    bindings: &[
        wgpu::BindGroupLayoutEntry {
            binding: 0,
            visibility: wgpu::ShaderStage::VERTEX,
            ty: wgpu::BindingType::UniformBuffer {
                dynamic: false,
            },
        }
    ],
    label: Some("uniform_bind_group_layout"),
});
```

<!--
1. We only really need camera information in the vertex shader, as that's what we'll use to manipulate our vertices.
2. The `dynamic` field indicates whether this buffer will change size or not. This is useful if we want to store an array of things in our uniforms.
-->
1. camera の情報は座標の操作に使うので頂点シェーダーでしか必要ありません。
2. `dynamic` は buffer のサイズが動的に変化するかどうかで、uniform が配列などの時に便利です。

<!--
Now we can create the actual bind group.
-->
bind group が作れるようになりました。

```rust
let uniform_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
    layout: &uniform_bind_group_layout,
    bindings: &[
        wgpu::Binding {
            binding: 0,
            resource: wgpu::BindingResource::Buffer {
                buffer: &uniform_buffer,
                // FYI: you can share a single buffer between bindings.
                // 補足: 一つの buffer を複数の binding で共有できます
                range: 0..std::mem::size_of_val(&uniforms) as wgpu::BufferAddress,
            }
        }
    ],
    label: Some("uniform_bind_group"),
});
```

<!--
Like with our texture, we need to register our `uniform_bind_group_layout` with the render pipeline.
-->
texture の様に `uniform_bind_group_layout` を render pipeline に登録する必要があります。

```rust
let render_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
    bind_group_layouts: &[&texture_bind_group_layout, &uniform_bind_group_layout],
});
```

<!--
Now we need to add `uniform_buffer` and `uniform_bind_group` to `State`
-->
`uniform_buffer` と `uniform_bind_group` を `State` に追加する必要があります。

```rust
struct State {
    camera: Camera,
    uniforms: Uniforms,
    uniform_buffer: wgpu::Buffer,
    uniform_bind_group: wgpu::BindGroup,
}

async fn new(window: &Window) -> Self {
    // ...
    Self {
        // ...
        camera,
        uniforms,
        uniform_buffer,
        uniform_bind_group,
        // ...
    }
}
```

<!--
The final thing we need to do before we get into shaders is use the bind group in `render()`.
-->
sharder に入る前に最後にやっておく必要があることは、 `render()` の中で bind group を使うことです。

```rust
render_pass.set_pipeline(&self.render_pipeline);
render_pass.set_bind_group(0, &self.diffuse_bind_group, &[]);
// NEW!
render_pass.set_bind_group(1, &self.uniform_bind_group, &[]);
render_pass.set_vertex_buffer(0, &self.vertex_buffer, 0, 0);
render_pass.set_index_buffer(&self.index_buffer, 0, 0);
render_pass.draw_indexed(0..self.num_indices, 0, 0..1);
```

<!--
## Using the uniforms in the vertex shader
-->
## 頂点シェーダーで uniform を使う

<!--
Modify `shader.vert` to include the following.
-->
`shader.vert` を変更します。

```glsl
#version 450

layout(location=0) in vec3 a_position;
layout(location=1) in vec2 a_tex_coords;

layout(location=0) out vec2 v_tex_coords;

// NEW!
layout(set=1, binding=0) // 1.
uniform Uniforms {
    mat4 u_view_proj; // 2.
};

void main() {
    v_tex_coords = a_tex_coords;
    // UPDATED!
    gl_Position = u_view_proj * vec4(a_position, 1.0); // 3.
}
```

<!--
1. Because we've created a new bind group, we need to specify which one we're using in the shader. The number is determined by our `render_pipeline_layout`. The `texture_bind_group_layout` is listed first, thus it's `set=0`, and `uniform_bind_group` is second, so it's `set=1`.
2. The `uniform` block requires us to specify global identifiers for all the fields we intend to use. It's important to only specify fields that are actually in our uniform buffer, as trying to access data that isn't there may lead to undefined behavior.
3. Multiplication order is important when it comes to matrices. The vector always goes on the right, and the matrices gone on the left in order of importance.
-->
1. 新しい bind group を作ったのでシェーダーにそれを明示する必要があります。番号は `render_pipeline_layout` によって決定します。`texture_bind_group_layout` がリストの最初なので `set=0` で、`uniform_bind_group` が二番目なので `set=1` です。
2. `uniform` ブロックでは、利用するつもりのすべてのフィールドにグローバルな識別子を指定する必要があります。存在しないデータにアクセスしようとすると未定義の動作を引き起こす可能性があるので、uniform buffer で実際に使うフィールドを明確にしておくことは重要です。
3. ここで掛け算の順序は重要です。ベクトルは常に右側に置き、行列は左側に置くのが重要です。

<!--
## A controller for our camera
-->
## カメラの操作
<!--
If you run the code right now, you should get something that looks like this.
-->
もしコードを正しく記述できていれば何か以下のようなものが見れるでしょう。

![./static-tree.png](./static-tree.png)

<!--
The shape's less stretched now, but it's still pretty static. You can experiment with moving the camera position around, but most cameras in games move around. Since this tutorial is about using wgpu and not how to process user input, I'm just going to post the `CameraController` code below.
-->
形は少し伸びていますが、まだ静的です。カメラの周りをオブジェクトの周りを移動しようとすることはできますが、ほとんどのゲームは周りに動かすことができます。このチュートリアルは wgpu を使っておりユーザー入力については触れていませんでした。 `CameraController` のコードを記載します。

```rust
struct CameraController {
    speed: f32,
    is_up_pressed: bool,
    is_down_pressed: bool,
    is_forward_pressed: bool,
    is_backward_pressed: bool,
    is_left_pressed: bool,
    is_right_pressed: bool,
}

impl CameraController {
    fn new(speed: f32) -> Self {
        Self {
            speed,
            is_up_pressed: false,
            is_down_pressed: false,
            is_forward_pressed: false,
            is_backward_pressed: false,
            is_left_pressed: false,
            is_right_pressed: false,
        }
    }

    fn process_events(&mut self, event: &WindowEvent) -> bool {
        match event {
            WindowEvent::KeyboardInput {
                input: KeyboardInput {
                    state,
                    virtual_keycode: Some(keycode),
                    ..
                },
                ..
            } => {
                let is_pressed = *state == ElementState::Pressed;
                match keycode {
                    VirtualKeyCode::Space => {
                        self.is_up_pressed = is_pressed;
                        true
                    }
                    VirtualKeyCode::LShift => {
                        self.is_down_pressed = is_pressed;
                        true
                    }
                    VirtualKeyCode::W | VirtualKeyCode::Up => {
                        self.is_forward_pressed = is_pressed;
                        true
                    }
                    VirtualKeyCode::A | VirtualKeyCode::Left => {
                        self.is_left_pressed = is_pressed;
                        true
                    }
                    VirtualKeyCode::S | VirtualKeyCode::Down => {
                        self.is_backward_pressed = is_pressed;
                        true
                    }
                    VirtualKeyCode::D | VirtualKeyCode::Right => {
                        self.is_right_pressed = is_pressed;
                        true
                    }
                    _ => false,
                }
            }
            _ => false,
        }
    }

    fn update_camera(&self, camera: &mut Camera) {
        use cgmath::InnerSpace;
        let forward = camera.target - camera.eye;
        let forward_norm = forward.normalize();
        let forward_mag = forward.magnitude();

        // Prevents glitching when camera gets too close to the
        // center of the scene.
        // カメラがシーンの中心にあまりに近寄ってグリッチが発生するのを避ける。
        if self.is_forward_pressed && forward_mag > self.speed {
            camera.eye += forward_norm * self.speed;
        }
        if self.is_backward_pressed {
            camera.eye -= forward_norm * self.speed;
        }

        let right = forward_norm.cross(camera.up);

        // Redo radius calc in case the up/ down is pressed.
        // up / down が押されたときは角度を再計算する
        let forward = camera.target - camera.eye;
        let forward_mag = forward.magnitude();

        if self.is_right_pressed {
            // Rescale the distance between the target and eye so 
            // that it doesn't change. The eye therefore still 
            // lies on the circle made by the target and eye.
            // 対象と視点の間の距離が変わらないよう、スケールを変更します。
            // 視点は視点と対象が作った円の上にあります。
            camera.eye = camera.target - (forward + right * self.speed).normalize() * forward_mag;
        }
        if self.is_left_pressed {
            camera.eye = camera.target - (forward - right * self.speed).normalize() * forward_mag;
        }
    }
    }
}
```

<!--
This code is not perfect. The camera slowly moves back when you rotate it. It works for our purposes though. Feel free to improve it!
-->
このコードは完全ではありません。回転させるとカメラはゆっくりと戻ります。これで目的としては十分です。自由に修正してください。

<!--
We still need to plug this into our existing code to make it do anything. Add the controller to `State` and create it in `new()`.
-->
まだこのコードを既存のコードに接続していません。controller を `State` の `new()` で生成しましょう。

```rust
struct State {
    // ...
    camera: Camera,
    // NEW!
    camera_controller: CameraController,
    // ...
}
// ...
impl State {
    async fn new(window: &Window) -> Self {
        // ...
        let camera_controller = CameraController::new(0.2);
        // ...

        Self {
            // ...
            camera_controller,
            // ...
        }
    }
}
```

<!--
We're finally going to add some code to `input()` (assuming you haven't already)!
-->
最後に `input()` にコードを追加します。(あなたがまだやっていないと仮定してですが)

```rust
fn input(&mut self, event: &WindowEvent) -> bool {
    self.camera_controller.process_events(event)
}
```

<!--
Up to this point, the camera controller isn't actually doing anything. The values in our uniform buffer need to be updated. There are 2 main methods to do that.
1. We can create a separate buffer and copy it's contents to our `uniform_buffer`. The new buffer is known as a staging buffer. This method is usually how it's done as it allows the contents of the main buffer (in this case `uniform_buffer`) to only be accessible by the gpu. The gpu can do some speed optimizations which it couldn't if we could access the buffer via the cpu.
2. We can call on of the mapping method's `map_read_async`, and `map_write_async` on the buffer itself. These allow us to access a buffer's contents directly, but requires us to deal with the `async` aspect of these methods this also requires our buffer to use the `BufferUsage::MAP_READ` and/or `BufferUsage::MAP_WRITE`. We won't talk about it here, but you check out [Wgpu without a window](../../showcase/windowless) tutorial if you want to know more.
-->
この時点では、カメラコントローラーは実際には何もやりません。uniform buffer を更新する必要があります。変更には 2 つの主要な手法があります。
1. 別の buffer を作り、`uniform_buffer` の内容を複製します。新しい buffer は staging buffer として知られています。この手法は main buffer のコンテンツ(ここでは `uniform_buffer`)を GPU のみにアクセスできるようにします。GPU は CPU buffer にアクセスすることができないという制約の下で、いくつか速度的な最適化を行うことができます。
2. もう一つの手法は buffer 自身を `map_read_async` や `map_write_async` として mapping します。これは buffer のコンテンツに直接のアクセスを許可しますが、代わりに async でそれらのメソッドを扱う必要があり buffer にも `BufferUsage::MAP_READ` や `BufferUsage::MAP_WRITE` が指定する必要があります。ここではそれらについて話しませんが [Wgpu without a window](../../showcase/windowless) というチュートリアルをすれば多くのことが知れるでしょう。

<!--
Enough about that though, let's get into actually implementing the code.
-->
説明はこれで十分なので実際にコードを実装してみましょう。

```rust
fn update(&mut self) {
    self.camera_controller.update_camera(&mut self.camera);
    self.uniforms.update_view_proj(&self.camera);

    // Copy operation's are performed on the gpu, so we'll need
    // a CommandEncoder for that
    // Copy 操作は GPU で行われるので CommandEncoder が必要です。
    let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("update encoder"),
    });

    let staging_buffer = self.device.create_buffer_with_data(
        bytemuck::cast_slice(&[self.uniforms]),
        wgpu::BufferUsage::COPY_SRC,
    );

    encoder.copy_buffer_to_buffer(&staging_buffer, 0, &self.uniform_buffer, 0, std::mem::size_of::<Uniforms>() as wgpu::BufferAddress);

    // We need to remember to submit our CommandEncoder's output
    // otherwise we won't see any change.
    // CommandEncoder の submit を忘れないようにしないと、変更が見れなくなります。
    self.queue.submit(&[encoder.finish()]);
}
```

<!--
That's all we need to do. If you run the code now you should see a pentagon with our tree texture that you can rotate around and zoom into with the wasd/arrow keys.
-->
これでに必要なことはすべてです。このコードを実行すると木のテクスチャの五角形を WASD キーや矢印キーで回したりズームすることができます。

## Challenge

<!--
Have our model rotate on it's own independently of the the camera. *Hint: you'll need another matrix for this.*
-->
モデルをカメラとは独立して回転させてみましょう。ヒント：カメラとは別の行列が必要になるでしょう。

<AutoGithubLink/>

<!-- TODO: add a gif/video for this -->

<!--
[ThinMatrix](https://www.youtube.com/watch?v=DLKN0jExRIM)
http://antongerdelan.net/opengl/raycasting.html
-->
