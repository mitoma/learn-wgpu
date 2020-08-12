# Instancing

<!--
Up to this point we've been drawing just one object. Most games have hundreds of objects on screen at the same time. If we wanted to draw multiple instances of our model, we could copy the vertex buffer and modify it's vertices to be in the right place, but this would be hilariously inefficient. We have our model, and we know how to position it in 3d space with a matrix, like we did the camera, so all we have to do is change the matrix we're using when we draw.
-->
この時点で、一つのオブジェクトを描くことができるようになりました。ほとんどのゲームは何百ものオブジェクトを同時にスクリーンに出します。もし、一つのモデルから複数のインスタンスを描画したいなら、頂点バッファをコピーして座標を別の場所に変えればよいですが、それは滑稽なほど非効率です。モデルがあれば、カメラでやったように三次元空間上にどこに置けばいいか示す行列があれば、マトリクスを変更してもう一度描画すればいいだけです。

<!--
## The naive method
-->
## ネイティブメソッド

<!--
First let's modify `Uniforms` to include a `model` property.
-->
最初に `Uniforms` に `model` プロパティを加えます。

```rust
#[repr(C)]
#[derive(Debug, Copy, Clone)]
struct Uniforms {
    view_proj: cgmath::Matrix4<f32>,
    model: cgmath::Matrix4<f32>, // NEW!
}

unsafe impl bytemuck::Pod for Uniforms {}
unsafe impl bytemuck::Zeroable for Uniforms {}

impl Uniforms {
    fn new() -> Self {
        use cgmath::SquareMatrix;
        Self {
            view_proj: cgmath::Matrix4::identity(),
            model: cgmath::Matrix4::identity(), // NEW!
        }
    }

    fn update_view_proj(&mut self, camera: &Camera) {
        self.view_proj = OPENGL_TO_WGPU_MATRIX * camera.build_view_projection_matrix();
    }
}
```

<!--
With that let's introduce another struct for our instances. We'll use it to store the position and rotation of our instances. We'll also have a method to convert our instance data into a matrix that we can give to `Uniforms`.
-->
それとともに、インスタンスのための別の構造体を紹介しましょう。これはインスタンスの位置や回転を保持するために使います。また、このインスタンスデータを `Uniforms` に与えるための行列に変換するメソッドもあります。

```rust
struct Instance {
    position: cgmath::Vector3<f32>,
    rotation: cgmath::Quaternion<f32>,
}

impl Instance {
    fn to_matrix(&self) -> cgmath::Matrix4<f32> {
        cgmath::Matrix4::from_translation(self.position)
            * cgmath::Matrix4::from(self.rotation)
    }
}
```

<!--
Next we'll add `instances: Vec<Instance>,` to `State` and create our instances with the following in `new()`.
-->
次に  `instances: Vec<Instance>,` を `State` に追加し、 `new()` の中で作ります。

```rust
// ...

// add these at the top of the file
// これらの定数をファイルの最初に追加します。
// NUM_INSTANCES_PER_ROW (一行当たりのインスタンス数)
// NUM_INSTANCES (インスタンス数)
// INSTANCE_DISPLACEMENT (インスタンスの移動幅)
const NUM_INSTANCES_PER_ROW: u32 = 10;
const NUM_INSTANCES: u32 = NUM_INSTANCES_PER_ROW * NUM_INSTANCES_PER_ROW;
const INSTANCE_DISPLACEMENT: cgmath::Vector3<f32> = cgmath::Vector3::new(NUM_INSTANCES_PER_ROW as f32 * 0.5, 0.0, NUM_INSTANCES_PER_ROW as f32 * 0.5);

// make a 10 by 10 grid of objects
// 10 x 10 のオブジェクトのグリッドを作ります。
let instances = (0..NUM_INSTANCES_PER_ROW).flat_map(|z| {
    (0..NUM_INSTANCES_PER_ROW).map(move |x| {
        let position = cgmath::Vector3 { x: x as f32, y: 0.0, z: z as f32 } - INSTANCE_DISPLACEMENT;

        let rotation = if position.is_zero() {
            // this is needed so an object at (0, 0, 0) won't get scaled to zero
            // as Quaternions can effect scale if they're not create correctly
            // この分岐が必要なのは (0, 0, 0) 座標のオブジェクトの大きさがゼロにスケールされないようにするためです。
            // クォータニオンが正しく作成されていないとスケーリングに影響を与える可能性があります。
            cgmath::Quaternion::from_axis_angle(cgmath::Vector3::unit_z(), cgmath::Deg(0.0))
        } else {
            cgmath::Quaternion::from_axis_angle(position.clone().normalize(), cgmath::Deg(45.0))
        };

        Instance {
            position, rotation,
        }
    })
}).collect();

// ...

Self {
    // ...
    instances,
}
```

<!--
Now that that's done, we need to update `shader.vert` to use the model matrix passed in through `Uniforms`.
-->
これでOKです。`Uniforms` で与えられたマトリクスを `shader.vert` もモデルで使いましょう。

```glsl
#version 450

layout(location=0) in vec3 a_position;
layout(location=1) in vec2 a_tex_coords;

layout(location=0) out vec2 v_tex_coords;

layout(set=1, binding=0)
uniform Uniforms {
    mat4 u_view_proj;
    mat4 u_model; // NEW!
};

void main() {
    v_tex_coords = a_tex_coords;
    gl_Position = u_view_proj * u_model * vec4(a_position, 1.0); // UPDATED!
}
```

<!--
If you run the program now, you won't see anything different. That's because we aren't actually updating the uniform buffer at all. Using our current method, we need to update the uniform buffer for every instance we draw. We'll do this in `render()` with something like the following.
-->
もし現時点でプログラムを動かしても、何も変化は見られません。実際に uniform バッファをまったく更新していないからです。今使っているメソッドを使って、すべてのインスタンスを描画するために uniform buffer を更新しましょう。`render()` を以下のように変更してみてください。

```rust
for instance in &self.instances {
    // 1.
    self.uniforms.model = instance.to_matrix();
    let staging_buffer = self.device.create_buffer_with_data(
        bytemuck::cast_slice(&[self.uniforms]),
        wgpu::BufferUsage::COPY_SRC,
    );
    encoder.copy_buffer_to_buffer(&staging_buffer, 0, &self.uniform_buffer, 0, std::mem::size_of::<Uniforms>() as wgpu::BufferAddress);

    // 2.
    let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
        color_attachments: &[
            wgpu::RenderPassColorAttachmentDescriptor {
                attachment: &frame.view,
                resolve_target: None,
                load_op: wgpu::LoadOp::Load, // 3.
                store_op: wgpu::StoreOp::Store,
                clear_color: wgpu::Color {
                    r: 0.1,
                    g: 0.2,
                    b: 0.3,
                    a: 1.0,
                },
            }
        ],
        depth_stencil_attachment: None,
    });

    render_pass.set_pipeline(&self.render_pipeline);
    render_pass.set_bind_group(0, &self.diffuse_bind_group, &[]);
    render_pass.set_bind_group(1, &self.uniform_bind_group, &[]);
    render_pass.set_vertex_buffer(0, &self.vertex_buffer, 0, 0);
    render_pass.set_index_buffer(&self.index_buffer, 0, 0);
    render_pass.draw_indexed(0..self.num_indices, 0, 0..1);
}
```

<!--
Some things to note:
1. We're creating a hundred buffers a frame. This is inefficent, but we'll cover better ways of doing this later in this tutorial.
2. We have to create a new render pass per instance, as we can't modify the uniform buffer while we have one active.
3. We use `LoadOp::Load` here to prevent the render pass from clearing the entire screen after each draw. This means we lose our clear color. This makes the background black on my machine, but it may be filled with garbage data on yours. We can fix this by added another render pass before the loop.
-->
いくつかのノート:
1. フレームに 100 のバッファを作ります。これは非効率ですが、このチュートリアルの最後でよい方法にします。
2. 新しい render pass をインスタンスごとに作成します。これは一つアクティブなバッファがあるとき uniform buffer を変更できないからです。
3. `LoadOp::Load` は render pass がそれぞれ描画を実行する時にスクリーン全体をクリアされるのを避けるために設定しています。これは画面をクリアするための色がなくなることを意味しています。これは私のマシンでは背景が真っ黒になりましたが、もしかしたらあなたの環境ではごみデータで塗りつぶされるかもしれません。これを修正するために別のrender pass をループの前に追加しましょう。

```rust
{
    encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
        color_attachments: &[
            wgpu::RenderPassColorAttachmentDescriptor {
                attachment: &frame.view,
                resolve_target: None,
                load_op: wgpu::LoadOp::Clear,
                store_op: wgpu::StoreOp::Store,
                clear_color: wgpu::Color {
                    r: 0.1,
                    g: 0.2,
                    b: 0.3,
                    a: 1.0,
                },
            }
        ],
        depth_stencil_attachment: None,
    });
}
```

<!--
We should get something that looks like this when we're done.
-->
上記の変更を加えると以下のような図が表示されるでしょう。

![A beautiful forest](./forest.png)

<!--
If you haven't guessed already, this way of instancing is not the best. It requires hundreds of render passes, hundereds of staging buffers, and an extra render pass just to get the clear color working again. Cleary there must be a better way.
-->
まだ気づいていないかもしれませんが、この方法は最善ではありません。これは 100 の render pass が必要になり 100 のバッファをステージングしなければいけません。そして clear color を有効にするためにもう一つ render pass を追加しなければいけません。もっと良い方法があることは明らかです。

## A better way - uniform arrays

<!--
Since GLSL is based on C, it supports arrays. We can leverage this by store *all* of the instance matrices in the `Uniforms` struct. We need to make this change on the Rust side, as well as in our shader.
-->
GLSL は C 言語をベースとしていますので、配列をサポートしています。`Uniforms` 構造体に保存されている **すべての** インスタンスマトリクスを活用できます。まずはRust 側に変更を加えてから shader 側を進めましょう。

```rust
#[repr(C)]
#[derive(Copy, Clone)]
struct Uniforms {
    view_proj: cgmath::Matrix4<f32>,
    model: [cgmath::Matrix4<f32>; NUM_INSTANCES as usize],
}
```

```glsl
#version 450

layout(location=0) in vec3 a_position;
layout(location=1) in vec2 a_tex_coords;

layout(location=0) out vec2 v_tex_coords;

layout(set=1, binding=0)
uniform Uniforms {
    mat4 u_view_proj;
    mat4 u_model[100];
};

void main() {
    v_tex_coords = a_tex_coords;
    // gl_InstanceIndex what index we're currently on
    // gl_InstanceIndex は現在のインデックス番号を返す。
    gl_Position = u_view_proj * u_model[gl_InstanceIndex] * vec4(a_position, 1.0);
}
```

<!--
Note that we're using an array, *not a `Vec`*. `Vec`s are basically pointers to an array on the heap. Our graphics card doesn't know how follow a pointer to the heap, so our data needs to be stored inline.
-->
配列を使うときには *`Vec` ではない* ことに気を付けてください。`Vec` は一般的にヒープ上の配列へのポインタです。グラフィックカードはヒープ状へのポインタはフォローされないのでインラインで保持する必要があるのです。

<!--
`Uniforms::new()` will change slightly as well.
-->
`Uniforms::new()` を少し変更します。

```rust
fn new() -> Self {
    Self {
        view_proj: cgmath::Matrix4::identity(),
        model: [cgmath::Matrix4::identity(); NUM_INSTANCES as usize],
    }
}
```

<!--
We need to update our model matrices in `State::update()` before we create the `staging_buffer`.
-->
`staging_buffer` を作る前に `State::update()` のモデルの行列を少し変えましょう。

```rust
for (i, instance) in self.instances.iter().enumerate() {
    self.uniforms.model[i] = instance.to_matrix();
}
```

<!--
Lastly we need to change our render code. Fortunately, it's a lot simpler than the before. In fact we can use the code from last tutorial and just change our draw call.
-->
最後に render するコードを変えます。幸運なことにこれまでに比べてこれはとてもシンプルです。事実、変更する場所はチュートリアルの最後の描画呼び出しを変えるだけです。

```rust
render_pass.draw_indexed(0..self.num_indices, 0, 0..NUM_INSTANCES);
```

<!--
You'll remember that the 3rd parameter in `draw_indexed` is the instance range. This controls how many times our object will be drawn. This is where our shader gets the value for `gl_InstanceIndex`.
-->
三つ目のパラメータ `draw_indexed` が instance の range だということを思い出したでしょうか。これは何回このオブジェクトの描画を行うかコントロールするものです。ここで shader が `gl_InstanceIndex` の値を取得するのです。

<!--
Running the program now won't change anything visually from our last example, but the framerate will be better.
-->
このプログラムを実行しても視覚的には前回のサンプルから変化はありませんが、フレームレートは改善しています。

<!--
This technique has its drawbacks.
1. We can't use a `Vec` like we've mentioned before
2. We're limited in the number of instances we can process at a time requiring use to cap it at some abitrary number, or render things in "batches". If we want to increase the size of instances, we have to recompile our code.
-->
このテクニックは以下の難点もあります。
1. 前述のように `Vec` を使うことができません
2. インスタンスの数が、処理によって制限されるので有効な数でに制限したりバッチで処理する必要があります。もしインスタンスの数を増やそうとすると、コードを再コンパイルする必要があります。(訳注:固定長配列なので動的にインスタンス数を増減させにくいということかな？)

## Another better way - storage buffers

<!--
A storage buffer gives us the flexibility that arrays did not. We don't have to specify it's size in the shader, and we can even use a `Vec` to create it!
-->
storage buffer は配列にはない柔軟性を与えてくれます。shader にサイズを明示する必要はありませんし、生成時に `Vec` を使うことができます。

<!--
Since we're using `bytemuck` for casting our data to `&[u8]`, we're going to need to define a custom scruct to store the `cgmath::Matrix4`s. We need to do this because we can't implement `bytemuck::Pod`, and `bytemuck::Zeroable`, on `cgmath::Matrix4` as it is an external type.
-->
`&[u8]` にデータをキャストするときに `bytemuck` を使っているので、 `cgmath::Matrix4` を格納するために私たちはカスタム構造体を定義する必要があります。なぜなら、 `mytemuck::Pod` と `bytemuck::Zeroable` は `cgmath::Matrix4` に実装することができないからで、その型は外部の型だからです。

```rust
// UPDATED!
impl Instance {
    // This is changed from `to_matrix()`
    // ここは `to_matrix()` から変えました。
    fn to_raw(&self) -> InstanceRaw {
        InstanceRaw {
            model: cgmath::Matrix4::from_translation(self.position) * cgmath::Matrix4::from(self.rotation),
        }
    }
}

// NEW!
#[repr(C)]
#[derive(Copy, Clone)]
struct InstanceRaw {
    model: cgmath::Matrix4<f32>,
}

unsafe impl bytemuck::Pod for InstanceRaw {}
unsafe impl bytemuck::Zeroable for InstanceRaw {}
```

<!--
We create a storage buffer in a similar way as any other buffer.
-->
storage buffer を他の buffer と同じように作ります。

```rust
let instance_data = instances.iter().map(Instance::to_raw).collect::<Vec<_>>();
// we'll need the size for later
// 後で size が必要になります。
let instance_buffer_size = instance_data.len() * std::mem::size_of::<cgmath::Matrix4<f32>>();
let instance_buffer = device.create_buffer_with_data(
    bytemuck::cast_slice(&instance_data),
    wgpu::BufferUsage::STORAGE_READ,
);
```

<!--
To get this buffer into the shader, we'll need to attach it to a bind group. We'll use `uniform_bind_group` just to keep things simple.
-->
このバッファを shader に入れるために、bind group にアタッチする必要があります。これを簡単にするため `uniform_bind_group` を作ります。

```rust
let uniform_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
    bindings: &[
        // ...
        wgpu::BindGroupLayoutEntry {
            binding: 1,
            visibility: wgpu::ShaderStage::VERTEX,
            ty: wgpu::BindingType::StorageBuffer {
                dynamic: false,
                readonly: true,
            },
        },
    ],
    // ...
});

let uniform_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
    layout: &uniform_bind_group_layout,
    bindings: &[
        // ...
        wgpu::Binding {
            binding: 1,
            resource: wgpu::BindingResource::Buffer {
                buffer: &instance_buffer,
                range: 0..instance_buffer_size as wgpu::BufferAddress,
            }
        },
    ],
});
```

<!--
*Note you'll probably need to shift your `instance_buffer` creation above the `uniform_bind_group` creation.*
-->
*`instance_buffer` を作成を `uniform_bind_group` の上に移動する必要があることに気を付けてください。*

<!--
We'll want to put `instance_buffer` into the `State` struct.
-->
`instance_buffer` を `State` 構造体の中に入れます。

<!--
You don't need to change the draw call at all from the previous example, but we'll need to change the vertex shader.
-->
描画呼び出しを前の例から変える必要はありませんが、頂点シェーダーに変更が必要です。

```glsl
#version 450

layout(location=0) in vec3 a_position;
layout(location=1) in vec2 a_tex_coords;

layout(location=0) out vec2 v_tex_coords;

layout(set=1, binding=0)
uniform Uniforms {
    mat4 u_view_proj;
};

layout(set=1, binding=1)
buffer Instances {
    mat4 s_models[];
};

void main() {
    v_tex_coords = a_tex_coords;
    gl_Position = u_view_proj * s_models[gl_InstanceIndex] * vec4(a_position, 1.0);
}
```

<!--
You can see that we got rid of the `u_model` field from the `Uniforms` block and create a new `Instances` located at `set=1, binding=1` corresponding with our bind group layout. Another thing to notice is that we use the `buffer` keyword for the block instead of `uniform`. The details of the `buffer` can be found on [the OpenGL wiki](https://www.khronos.org/opengl/wiki/Shader_Storage_Buffer_Object).
-->
`Uniforms` ブロックから `u_model` フィールドをなくし、bind group のレイアウトと一致しさせた `Instances` を `set=1, binding=1` の位置で作成しています。別の点として `uniform` の代わりに `buffer` キーワードが使われていることにも気づくでしょう。`buffer` の詳細については [the OpenGL wiki](https://www.khronos.org/opengl/wiki/Shader_Storage_Buffer_Object) を参照してください。

<!--
This method is nice because it allows us to store more data overall as storage buffers can theoretically store as much data as the GPU can handle, where uniform buffers are capped. This does mean that storage buffers are slower that uniform buffers as they are stored like other buffers such as textures as and therefore aren't as close in memory, but that usually won't matter much if you're dealing with large amounts of data.
-->
この方法は、uniform buffer で制限されるようなケースでも、理論的には GPU が扱えるメモリと同程度に多くのデータを扱えるため便利です。これは storege buffer が uniform buffer や texture など他の buffer を保存するときと同じぐらい遅く、メモリから遠い場所にあるという事を意味します。が、たいていの場合は大量のデータ処理をしている間はあまり問題になりません

<!--
Another benefit to storage buffers is that they can be written to by the shader, unlike uniform buffers. If we want to mutate a large amount of data with a compute shader, we'd use a writeable storage buffer for our output (and potentially input as well).
-->
storage buffer のもう一つの利点は uniform buffer と異なり shader で書き込めることです。もし大量のデータをシェーダー計算で変化させたければ、writable な storage buffer を利用すればよいのです。(それは潜在的に入力にもなります。)

## Another better way - vertex buffers

<!--
When we created the `VertexBufferDescriptor` for our model, it required a `step_mode` field. We used `InputStepMode::Vertex`, this time we'll create a `VertexBufferDescriptor` for our `instance_buffer`.
-->
モデルに対して `VertexBufferDescriptor` を作りましたが、これは `step_mode` フィールドが必須となります。`InputStepMode::Vertex` を使いましたが、今回は `instance_buffer` に `VertexBufferDescriptor` を作ります。

<!--
We'll take the code from the previous example and then create a trait called `VBDesc`, and implement it for `Vertex` (replacing the old `impl`), and a newly created `InstanceRaw` class. *Note: we could just `impl VBDesc for cgmath::Matrix4<f32>` instead, but instances could have more data in the future, so it's better to create a new struct.*
-->
前のサンプルコードからコードを流用して `VBDesc` という trait を作り、 `Vertex` に対して実装しましょう。(古い `impl` を置き換えます)そして新しい `InstanceRaw` class を作ります。*ノート: 代わりに `impl VBDesc for cgmath::Matrix4<f32>` というものを作る事もできますが、インスタンスに多くのデータを将来置くこともあるかもしれませんので、新しい構造体を作るほうがよいでしょう。*

<!--
Here's our new trait.
-->
これが新しい trait です。

```rust
trait VBDesc {
    fn desc<'a>() -> wgpu::VertexBufferDescriptor<'a>;
}
```

<!--
To change `Vertex` to use this, we just have to swap `impl Vertex`, for `impl VBDesc for Vertex`.
-->
`Vertex` を使うのをやめて変更してこれを使いましょう。 `impl Vertex` を `impl VBDesc for Vertex` にします。

<!--
With that done we can implement `VBDesc` for `InstanceRaw`.
-->
これで `InstanceRaw` に `VBDesc` を実装できます。

```rust
const FLOAT_SIZE: wgpu::BufferAddress = std::mem::size_of::<f32>() as wgpu::BufferAddress;
impl VBDesc for InstanceRaw {
    fn desc<'a>() -> wgpu::VertexBufferDescriptor<'a> {
        wgpu::VertexBufferDescriptor {
            stride: std::mem::size_of::<InstanceRaw>() as wgpu::BufferAddress,
            step_mode: wgpu::InputStepMode::Instance, // 1.
            attributes: &[
                wgpu::VertexAttributeDescriptor {
                    offset: 0,
                    format: wgpu::VertexFormat::Float4, // 2.
                    shader_location: 2, // 3.
                },
                wgpu::VertexAttributeDescriptor {
                    offset: FLOAT_SIZE * 4,
                    format: wgpu::VertexFormat::Float4,
                    shader_location: 3,
                },
                wgpu::VertexAttributeDescriptor {
                    offset: FLOAT_SIZE * 4 * 2,
                    format: wgpu::VertexFormat::Float4,
                    shader_location: 4,
                },
                wgpu::VertexAttributeDescriptor {
                    offset: FLOAT_SIZE * 4 * 3,
                    format: wgpu::VertexFormat::Float4,
                    shader_location: 5,
                },
            ]
        }
    }
}
```

<!--
Let's unpack this a bit.
1. This line makes what would be a vertex buffer into and index buffer. If we didn't specify this, the shader would loop through the elements in this list for every vertex.
2. Vertex attributes have a limited size: `Float4` or the equivalent. This means that our instance buffer will take up multiple attribute slots. 4 in our case.
3. Since we're using 2 slots for our `Vertex` struct, we need to start the `shader_location` at 2.
-->
これを少し紐解いてみましょう。
1. この行は vertex buffer の中に index buffer にしています。もしここを明示しない場合、shader は頂点ごとに要素をループするようになります。
2. 頂点の要素のサイズを `Float4` や同等のものに制限しています。これは instance buffer をは複数の要素すスロットルを取れることを意味しています。このケースでは 4 つです。
3. すでに `Vertex` 構造体では2つのスロットルを使っていたので `sharder_location` は 2 から始めます。

<!--
Now we need to add a `VertexBufferDescriptor` to our `render_pipeline`.
-->
`VertexBufferDescriptor` を `render_pipeline` に追加します。

```rust
let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
    // ...
    vertex_state: wgpu::VertexStateDescriptor {
        index_format: wgpu::IndexFormat::Uint16,
        vertex_buffers: &[
            Vertex::desc(),
            InstanceRaw::desc(), // NEW!
        ],
    },
    // ...
});
```

<!--
*You'll probably want to remove the `BindGroupLayoutBinding` and `Binding` from `uniform_bind_group_layout` and `uniform_bind_group` respectively, as we won't be accessing our buffer from there.*
-->
*`BindGroupLayoutBinding` と `Binding` を `uniform_bind_group_layout` や `uniform_bind_group` からそれぞれ削除したほうがよいでしょう。それらの buffer にはアクセスすることがなくなります。*

<!--
We'll also want to change `instance_buffer`'s `BufferUsage` to `VERTEX`.
-->
`instance_buffer` の `BufferUsage` を `VERTEX` に変更しましょう。

```rust
let instance_data = instances.iter().map(Instance::to_raw).collect::<Vec<_>>();
let instance_buffer = device.create_buffer_with_data(
    bytemuck::cast_slice(&instance_data),
    wgpu::BufferUsage::VERTEX,
);
```

<!--
This last thing we'll need to do from Rust is use our `instance_buffer` in the `render()` method.
-->
Rust 側で最後に必要なのは `instance_buffer` を `render()` の中で使うようにすることです。

```rust
render_pass.set_vertex_buffer(0, &self.vertex_buffer, 0, 0);
render_pass.set_vertex_buffer(1, &self.instance_buffer, 0, 0); // NEW!
```

<!--
Now we get to the shader. We don't have to change much, we just make our shader reference our `instance_buffer` through the attributes rather than a uniform/buffer block.
-->
次に shader に取り掛かります。大きな変更はありません。shader の `instance_buffer` の参照を uniform/buffer ブロックではなく attribute を通して行うだけです。

```glsl
#version 450

layout(location=0) in vec3 a_position;
layout(location=1) in vec2 a_tex_coords;

layout(location=2) in mat4 a_model; // NEW!

layout(location=0) out vec2 v_tex_coords;

layout(set=1, binding=0)
uniform Uniforms {
    mat4 u_view_proj;
};

void main() {
    v_tex_coords = a_tex_coords;
    gl_Position = u_view_proj * a_model * vec4(a_position, 1.0); // UPDATED!
}
```

<!--
That's all you need to get an instance buffer working! There's a bit of overhead to get things working, and there are a few quirks, but it gets the job.
-->
instance buffer を動作させるために必要なのはこれだけです。これは動作するのに少しオーバーヘッドがあり、いくつか癖がありますが、これで仕事ができます。

## A different way - textures

<!--
This seems like a really backwards way to do instancing. Storing non image data in a texture seems really bizarre even though it's a perfectly valid thing to do. After all, a texture is just an array of bytes, and that could theoretically be anything. In our case, we're going to cram our matrix data into that array of bytes.
-->
これはいくらか instancing から後退した方法見えるでしょう。テクスチャに画像以外のデータを置くことは突飛に見えるかもしれませんが完全に正当な使い方です。テクスチャはバイト配列なので理論上何でもおけます。今回のケースでは行列データをバイト列に詰め込みます。

<!--
If you're following along, it'd be best to start from the storage buffer example. We're going to modify it to take our `instance_buffer`, and copy it into a 1D `instance_texture`. First we need to create the texture.
-->
もしあなたが順番に読み進めている場合、ここは storage buffer の例から始めるのがいいでしょう。 `instance_buffer` を変更し、 それを一次元の `instance_texture` にコピーします。最初にテクスチャを作成します。

<!--
* We won't use our `texture` module for this, though we could refactor it to store random data as a texture.
-->
* ここでは `texture` モジュールは使いませんが、`texture` モジュールをランダムなデータを保存できるようにリファクタすることもできます。

```rust
let instance_extent = wgpu::Extent3d {
    width: instance_data.len() as u32 * 4,
    height: 1,
    depth: 1,
};

let instance_texture = device.create_texture(&wgpu::TextureDescriptor {
    size: instance_extent,
    array_layer_count: 1,
    mip_level_count: 1,
    sample_count: 1,
    dimension: wgpu::TextureDimension::D1,
    format: wgpu::TextureFormat::Rgba32Float,
    usage: wgpu::TextureUsage::SAMPLED | wgpu::TextureUsage::COPY_DST,
    label: Some("instance_texture"),
});
```

<!--
All of this is fairly normal texture creation stuff, save two things:
1. We specify the height of the texture as 1. While you could theoretically use a height greater than 1, keeping the texture 1D simplifies things a bit. This also means that we need to use `TextureDimension::D1` for our `dimension`.
2. We're using `TextureFormat::Rgba32Float` for the texture format. Since our matrices are 32bit floats, this makes sense. We could use lower memory formats such as `Rgba16Float`, or even `Rgba8UnormSrgb`, but we loose precision when we do that. We might not need that precision for basic rendering, but applications that need to model reality definetly do.
-->
これは二つの点を除いて普通のテクスチャ作成です。
1. テクスチャの高さに 1 を指定します。理論上は 1 以上を指定することができますが、1 次元にすることで単純化できます。これはまた、`dimension` に `TextureDimension::D1` を指定する必要があることを意味します。
2. テクスチャのフォーマットに `TextureFormat::Rgba32Float` を使います。行列は 32bit の float を使っているのでこれは理にかなっています。メモリを節約するために `Rgba16Float` や `Rgba8UnormSrgb` を使うこともできますが、精度が落ちます。基本的なレンダリングには精度はあまり必要としないでしょうが、リアリティのあるモデルが必要なアプリケーションには間違いなく必要です。

<!--
With that said, let's create our texture view and sampler for our `instance_texture`.
-->
それでは、texture view と sampler を `instance_texture` に作りましょう。

```rust
let instance_texture_view = instance_texture.create_default_view();
let instance_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
    address_mode_u: wgpu::AddressMode::ClampToEdge,
    address_mode_v: wgpu::AddressMode::ClampToEdge,
    address_mode_w: wgpu::AddressMode::ClampToEdge,
    mag_filter: wgpu::FilterMode::Nearest,
    min_filter: wgpu::FilterMode::Nearest,
    mipmap_filter: wgpu::FilterMode::Nearest,
    lod_min_clamp: -100.0,
    lod_max_clamp: 100.0,
            compare: wgpu::CompareFunction::Always,
});
```

<!--
Then we need to copy the `instance_buffer` to our `instance_texture`.
-->
`instance_texture` に `instance_buffer` をコピーする必要があります。

```rust
let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
    label: Some("instance_texture_encoder"),
});
encoder.copy_buffer_to_texture(
    wgpu::BufferCopyView {
        buffer: &instance_buffer,
        offset: 0,
        bytes_per_row: std::mem::size_of::<f32>() as u32 * 4,
        rows_per_image: instance_data.len() as u32 * 4,
    },
    wgpu::TextureCopyView {
        texture: &instance_texture,
        mip_level: 0,
        array_layer: 0,
        origin: wgpu::Origin3d::ZERO,
    },
    instance_extent,
);
queue.submit(&[encoder.finish()]);
```

<!--
Now we need to add our texture and sampler to a bind group. Let with the storage buffer example, we'll use `uniform_bind_group` and its corresponding layout.
-->
texture と sampler を bind group に追加する必要があります。storage buffer の例から `uniform_bind_group` が layout が一致しているので使います。

```rust
let uniform_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
    bindings: &[
        // ...
        wgpu::BindGroupLayoutEntry {
            binding: 1,
            visibility: wgpu::ShaderStage::VERTEX,
            ty: wgpu::BindingType::SampledTexture {
                multisampled: false,
                component_type: wgpu::TextureComponentType::Uint,
                dimension: wgpu::TextureViewDimension::D1,
            }
        },
        wgpu::BindGroupLayoutEntry {
            binding: 2,
            visibility: wgpu::ShaderStage::VERTEX,
            ty: wgpu::BindingType::Sampler { comparison: false },
        },
    ],
    // ...
});

let uniform_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
    layout: &uniform_bind_group_layout,
    bindings: &[
        // ...
        wgpu::Binding {
            binding: 1,
            resource: wgpu::BindingResource::TextureView(&instance_texture_view),
        },
        wgpu::Binding {
            binding: 2,
            resource: wgpu::BindingResource::Sampler(&instance_sampler),
        },
    ],
    // ...
});
```

<!--
With all that done we can now move onto the vertex shader. Let's start with the new uniforms. *Don't forget to delete the old `buffer` block.*
-->
これですべて完了したので vertex shader に移ります。*古い `buffer` block を削除することを忘れないでください。*

```glsl
// we use a texture1D instead of texture2d because our texture is 1D
// texture を一次元で作ったので texture2D ではなく texture1D を使います。
layout(set = 1, binding = 1) uniform texture1D t_model;
layout(set = 1, binding = 2) uniform sampler s_model;
```

<!--
The next part is a little more intensive, as there's now built in way to process our texture data as matrix data. We'll have to write a function to do that.
-->
次のパートはテクスチャデータを行列データとして処理する方法を組み込みますので、少し突っ込んだところになります。それを行うための関数を書かなければいけません。

```glsl
mat4 get_matrix(int index) {
    return mat4(
        texelFetch(sampler1D(t_model, s_model), index * 4, 0),
        texelFetch(sampler1D(t_model, s_model), index * 4 + 1, 0),
        texelFetch(sampler1D(t_model, s_model), index * 4 + 2, 0),
        texelFetch(sampler1D(t_model, s_model), index * 4 + 3, 0)
    );
}
```

<!--
This function takes in the index of the instance of the model we are rendering, and pulls our 4 pixels from the image corresponding to to 4 sets of floats that make up that instance's matrix. It then packs them into a `mat4` and returns that.
-->
この関数はレンダリングするモデルのインスタンスのインデックスを受け取り、画像でいう4ピクセル分を取得し、4つの float 値をインスタンスの行列として返します。それは `mat4` という型に詰め込まれています。

<!--
Now we need to change our `main()` function to use `get_matrix()`.
-->
`main()` から `get_matrix()` を使うように修正する必要があります。

```glsl
void main() {
    v_tex_coords = a_tex_coords;
    mat4 transform = get_matrix(gl_InstanceIndex);
    gl_Position = u_view_proj * transform * vec4(a_position, 1.0);
}
```

<!--
There's a couple of things we need to do before this method will work. First `instance_buffer` we'll need to be `BufferUsage::COPY_SRC`.
-->
それに伴い修正するところがあります。最初は `instance_buffer` を `BufferUsage::COPY_SRC` にすることです。

```rust
let instance_buffer = device.create_buffer_with_data(
    bytemuck::cast_slice(&instance_data),
    wgpu::BufferUsage::COPY_SRC, // UPDATED!
);
```

<!--
You'll need is to remove `InstanceRaw::desc()` from the `render_pipeline`'s `vertex_state`.
-->
`render_pipeline` の `vertex_state` から `InstanceRaw::desc()` も削除します。

```rust
let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
    // ...
    vertex_state: wgpu::VertexStateDescriptor {
        index_format: wgpu::IndexFormat::Uint16,
        vertex_buffers: &[
            Vertex::desc(),
        ],
    },
    // ...
});
```

<!--
Lastly you'll want to store `instance_texture` in `State` to prevent it from being disposed of.
-->
最後に `State` の `instance_texture` に保存してデータが消されないようにします。

```rust
// new()
Self {
    // ...
    instance_texture,
}
```

<!--
That's a lot more work than the other method's, but it's still good to know that you can use textures store things other then color. This technique does come in handy when other solutions are not available, or not as performant. It's good to be aware of the possibilities!
-->
他のやり方よりも多くの事をやりましたが、テクスチャを使って色以外のものを保存するのはそれでもなお良いことです。このテクニックは他の解決策が使えないときやパフォーマンスが出ないときに便利です。できることを知っておくのは良いことです。

<!--
For fun, here's what our matrix data looks like when converted into a texture (scaled up 10 times)!
-->
面白いものを見せておくと、これが行列をテクスチャに変換したものです。(10倍に拡大しています)

![lots of colorful squares](./instance_texture_scaled.png)

<!--
## Recap
-->
## 要約(比較表)

 <table style="width:100%">
    <tr>
        <th>Technique</th>
        <th>Pros</th>
        <th>Cons</th>
    </tr>
    <tr>
<!--
        <td>Naive Approach</td>
        <td><ul><li>Super simple</li></ul></td>
        <td><ul><li>Super slow with lots of instances</li></ul></td>
-->
        <td>Naive Approach</td>
        <td><ul><li>非常にシンプル</li></ul></td>
        <td><ul><li>多くのインスタンスを扱うとき非常に遅い</li></ul></td>
    </tr>
    <tr>
<!--
        <td>Uniform Buffer</td>
        <td><ul>
            <li>Quicker then other techniques</li>
        </ul></td>
        <td><ul>
            <li>Requires using fixed size array</li>
            <li>Limited size</li>
            <li>Requires a bind group</li>
        </ul></td>
-->
        <td>Uniform Buffer</td>
        <td><ul>
            <li>他のテクニックよりも早い</li>
        </ul></td>
        <td><ul>
            <li>固定長の配列を使わないといけない</li>
            <li>サイズに制限がある</li>
            <li>bind group を使わないといけない</li>
        </ul></td>
    </tr>
    <tr>
<!--
        <td>Storage Buffer</td>
        <td><ul>
            <li>Larger size</li>
            <li>Allows modifying data</li>
            <li>We can use <code>Vec</code></li>
        </ul></td>
        <td><ul>
            <li>Slower than uniform buffers</li>
            <li>Requires a bind group</li>
        </ul></td>
-->
        <td>Storage Buffer</td>
        <td><ul>
            <li>サイズが大きい</li>
            <li>データを変更できる</li>
            <li><code>Vec</code>を使える</li>
        </ul></td>
        <td><ul>
            <li>uniform buffer より遅い</li>
            <li>bind group を使わないといけない</li>
        </ul></td>
    </tr>
    <tr>
<!--
        <td>Instance Buffer</td>
        <td><ul>
            <li>Larger size</li>
            <li>Doesn't need <code>gl_InstanceIndex</code></li>
        </ul></td>
        <td><ul>
            <li>Requires <code>VertexBufferDescriptor</code></li>
            <li>Requires passing in the vertex buffer to the render pass</li>
            <li>Vertex attributes are limited in size (4 floats)</li>
        </ul></td>
-->
        <td>Instance Buffer</td>
        <td><ul>
            <li>サイズが大きい</li>
            <li><code>gl_InstanceIndex</code>を使う必要がない</li>
        </ul></td>
        <td><ul>
            <li><code>VertexBufferDescriptor</code> を使わないといけない</li>
            <li>render pass でvertex buffer を渡す必要がある</li>
            <li>頂点アトリビュートはサイズに制限がある(4 floats)</li>
        </ul></td>
    </tr>
    <tr>
<!--
        <td>Textures</td>
        <td><ul>
            <li>Universally supported</li>
            <li>Faster than naive approach</li>
        </ul></td>
        <td><ul>
            <li>Requires decoding data manually</li>
            <li>Limited to by pixel format</li>
            <li>Requires a copying data to the texture via buffer</li>
            <li>Requires a bind group</li>
        </ul></td>
-->
        <td>Textures</td>
        <td><ul>
            <li>どこでもサポートされる</li>
            <li>naive approachより速い</li>
        </ul></td>
        <td><ul>
            <li>データを手動ででコードする必要がある</li>
            <li>渡すデータを pixel format に制限される</li>
            <li>buffer を通してテクスチャデータをコピーする必要がある</li>
            <li>bind group を使わないといけない</li>
        </ul></td>
    </tr>
</table>

## About the depth issues...

<!--
You may have noticed that some of the back pentagons are rendering in front of the ones in the front. This is a draw order issue. We could solve this by sorting the instances from back to front, that would only work from certain camera angles. A more flexible approach would be to use a *depth buffer*. We'll talk about those [next time](/todo).
-->
もしかしたらお気づきかもしれませんが、後ろの五角形の前の五角形よりも前にレンダリングがされています。これは描画順序の問題です。インスタンスを後ろのほうから前のほうに向けてソートしてレンダリングすることでも解決できますが、カメラのアングルが一定の時だけです。より柔軟なアプローチは *depth buffer* を使います。これは[次の機会に](/todo)お話しましょう。

## Challenge

<!--
Modify the position and/or rotation of the instances every frame.
-->
インスタンスのポジションや角度を毎フレームごとに変えてみましょう。

<AutoGithubLink/>
