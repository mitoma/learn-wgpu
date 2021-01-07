# Instancing

<!--
Our scene right now is very simple: we have one object centered at (0,0,0). What if we wanted more objects? This is were instancing comes in. 
-->
シーンは今のところとてもシンプルです。オブジェクトは (0, 0, 0) の中心に置かれています。もし多数のオブジェクトを置きたいときにはどうすればいいでしょう。インスタンシングの出番です。

<!--
Instancing allows us to draw the same object multiple times with different properties (position, orientation, size, color, etc.). There are multiple ways of doing instancing. One way would be to modify the uniform buffer to include these properties and then update it before we draw each instance of our object.
-->
インスタンシングによって同じオブジェクトを複数回異なったプロパティ(ポジション、向き、大きさ、色など)で描画できるようになります。インスタンシングには複数の方法があります。一つは uniform buffer にそれらの変更されるプロパティを入れ、それぞれのインスタンスの描画前に更新する方法です。

<!--
We don't want to use this method for performance reasons. Updating the uniform buffer for each instance would require multiple buffer copies each frame. On top of that, our method to update the uniform buffer currently requires use to create a new buffer to store the updated data. That's a lot of time wasted between draw calls.
-->
この方法はパフォーマンスの点で使いたくありません。uniform buffer をそれぞれのインスタンスの描画ごとに更新すると、それぞれのフレームで複数回 buffer のコピーが発生します。それに加えて、 uniform buffer を更新する方法は現在、新しい buffer を作成して更新データを保存する必要があります。これは描画呼び出しの間の多くの無駄な時間になります。

<!--
If we look at the parameters for the `draw_indexed` function [in the wgpu docs](https://docs.rs/wgpu/0.5.2/wgpu/struct.RenderPass.html#method.draw_indexed), we can see a solution to our problem.
-->
[in the wgpu docs](https://docs.rs/wgpu/0.5.2/wgpu/struct.RenderPass.html#method.draw_indexed) に書かれている `draw_indexed` 関数のパラメーターを見ると、この問題に対する解決法がわかるでしょう。

```rust
pub fn draw_indexed(
    &mut self,
    indices: Range<u32>,
    base_vertex: i32,
    instances: Range<u32> // <-- This right here
)
```

<!--
The `instances` parameter takes a `Range<u32>`. This parameter tells the GPU how many copies, or instances, of our model we want to draw. Currently we are specifying `0..1`, which instructs the GPU to draw our model once, and then stop. If we used `0..5`, our code would draw 5 instances.
-->
`instances` パラメータは `Range<u32`> をとります。このパラメータは GPU にモデルを描画するのに何回コピーするか、あるいはいくつインスタンスがあるかを教えます。現在、 `0..1` の間でしか渡していませんのでこの操作ではモデルは一回しか書かれずに終わってしまいます。もし `0..5` なら 5 インスタンス描画されます。

<!--
The fact that `instances` is a `Range<u32>` may seem weird as using `1..2` for instances would still draw 1 instance of our object. Seems like it would be simpler to just use a `u32` right? The reason it's a range is because sometimes we don't want to draw **all** of our objects. Sometimes we want to draw a selection of them, because others are not in frame, or we are debugging and want to look at a particular set of instances.
-->
実際には `instances` は `Range<u32>` として `1..2` という奇妙な値を渡すこともありますが、これも 1 インスタンスの描画になります。`u32` を単に渡したほうがシンプルだと思いますか？range を使っている理由は、しばしば **全ての** オブジェクトを描画したくないケースがあるからです。例えばほかのものはフレームから外れていたり、特定のインスタンスの集まりデバックしたいといったケースではそれらのうち選択されたものだけを描画したくなります。

<!--
Ok, now we know how to draw multiple instances of an object, how do we tell wgpu what particular instance to draw? We are going to use something known as an instance buffer.
-->
では、どのようにオブジェクトの複数のインスタンスを描画するか分かったところで、wgpu にどのように特定のインスタを描画するように指定すればよいでしょう？instance buffer と呼ばれるものを使います。

## The Instance Buffer

<!--
We'll create an instance buffer in a similar way to how we create a uniform buffer. First we'll create a struct called `Instance`.
-->
instance buffer は uniform buffer を作るのと似たような方法で作れます。最初に `Instance` 構造体を作ります。

```rust
// main.rs
// ...

// NEW!
struct Instance {
    position: cgmath::Vector3<f32>,
    rotation: cgmath::Quaternion<f32>,
}
```

<div class="note">

<!--
A `Quaternion` is a mathematical structure often used to represent rotation. The math behind them is beyond me (it involves imaginary numbers and 4D space) so I won't be covering them here. If you really want to dive into them [here's a Wolfram Alpha article](https://mathworld.wolfram.com/Quaternion.html).
-->
クォータニオンは、回転を表す数学的構造としてしばしば使われます。それらの背後にある数学は私の理解を超えているので(これは虚数と四次元空間を含みます)ここではそれをカバーしません。もし本当にそれらを知りたくなったら [Wolfram Alpha article](https://mathworld.wolfram.com/Quaternion.html) を読みましょう。

</div>

<!--
Using these values directly in the shader would be a pain as quaternions don't have a GLSL analog. I don't feel like writing the math in the shader, so we'll convert the `Instance` data into a matrix and store it into a struct called `InstanceRaw`.
-->
クォータニオンは GLSL に類似のものがないので、これらの値を直接 shader で扱うのは面倒になります。数学的なことを shader で書きたくないので `Instance` データを行列にして `InstanceRaw` という構造体に保存することにします。

```rust
// NEW!
#[repr(C)]
#[derive(Copy, Clone, bytemuck::Pod, bytemuck::Zeroable)]
struct InstanceRaw {
    model: [[f32; 4]; 4],
}
```

<!--
This is the data that will go into the `wgpu::Buffer`. We keep these separate so that we can update the `Instance` as much as we want without needing to mess with matrices. We only need to update the raw data before we draw.
-->
これは `wgpu::Buffer` に入るデータです。行列を変更することなく `Instance` を更新できるようにするためこれらを別々に保持します。描画前に raw data を更新するだけです。

<!--
Let's create a method on `Instance` to convert to `InstanceRaw`.
-->
では `Instance` を `InstanceRaw` にコンバートする処理を書きましょう。

```rust
// NEW!
impl Instance {
    fn to_raw(&self) -> InstanceRaw {
        InstanceRaw {
            model: (cgmath::Matrix4::from_translation(self.position) * cgmath::Matrix4::from(self.rotation)).into(),
        }
    }
}
```

<!--
Now we need to add 2 fields to `State`: `instances`, and `instance_buffer`.
-->
`State` に `instances` と `instance_buffer` の二つのフィールドが必要になります。

```rust
struct State {
    instances: Vec<Instance>,
    instance_buffer: wgpu::Buffer,
}
```

<!--
We'll create the instances in `new()`. We'll use some constants to simplify things. We'll display our instances in 10 rows of 10, and they'll be spaced evenly apart.
-->
instances を `new()` で作成します。簡単にするためにいくつかの定数を使います。10 x 10 のインスタンスを等間隔に配置して表示しましょう。

```rust
const NUM_INSTANCES_PER_ROW: u32 = 10;
const NUM_INSTANCES: u32 = NUM_INSTANCES_PER_ROW * NUM_INSTANCES_PER_ROW;
const INSTANCE_DISPLACEMENT: cgmath::Vector3<f32> = cgmath::Vector3::new(NUM_INSTANCES_PER_ROW as f32 * 0.5, 0.0, NUM_INSTANCES_PER_ROW as f32 * 0.5);
```

<!--
Now we can create the actual instances. 
-->
実際のインスタンスを作ります。

```rust
impl State {
    async fn new(window: &Window) -> Self {
        // ...
        let instances = (0..NUM_INSTANCES_PER_ROW).flat_map(|z| {
            (0..NUM_INSTANCES_PER_ROW).map(move |x| {
                let position = cgmath::Vector3 { x: x as f32, y: 0.0, z: z as f32 } - INSTANCE_DISPLACEMENT;

                let rotation = if position.is_zero() {
                    // this is needed so an object at (0, 0, 0) won't get scaled to zero
                    // as Quaternions can effect scale if they're not created correctly
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
        }).collect::<Vec<_>>();
        // ...
    }
}
```

<!--
Now that we have our data, we can create the actual `instance_buffer`.
-->
これでデータができたので、実際の `instance_buffer` を作ることができるます。

```rust
let instance_data = instances.iter().map(Instance::to_raw).collect::<Vec<_>>();
let instance_buffer = device.create_buffer_init(
    &wgpu::util::BufferInitDescriptor {
        label: Some("Instance Buffer"),
        contents: bytemuck::cast_slice(&instance_data),
        usage: wgpu::BufferUsage::VERTEX,
    }
);
```

<!--
We're going to need to create a new `VertexBufferDescriptor` for `InstanceRaw`.
-->
`InstanceRaw` のために新しい `VertexBufferDescriptor` を生成する必要があります。

```rust
impl InstanceRaw {
    fn desc<'a>() -> wgpu::VertexBufferDescriptor<'a> {
        use std::mem;
        wgpu::VertexBufferDescriptor {
            stride: mem::size_of::<InstanceRaw>() as wgpu::BufferAddress,
            // We need to switch from using a step mode of Vertex to Instance
            // This means that our shaders will only change to use the next
            // instance when the shader starts processing a new instance
            // step mode を Vertex から Instance に切り替える必要があります。
            // これはシェーダーが新しいインスタンスを処理するときだけ
            // 次のインスタンスを使用するようにすることを意味します。
            step_mode: wgpu::InputStepMode::Instance,
            attributes: &[
                wgpu::VertexAttributeDescriptor {
                    offset: 0,
                    // While our vertex shader only uses locations 0, and 1 now, in later tutorials we'll
                    // be using 2, 3, and 4, for Vertex. We'll start at slot 5 not conflict with them later
                    // このチュートリアルの頂点シェーダでは、location 0 と 1 だけしか使っていませんが、
                    // 後のチュートリアルでは 2, 3, 4 も 頂点シェーダで使います。
                    // スロット 5 以降を使えばコンフリクトしません。
                    shader_location: 5,
                    format: wgpu::VertexFormat::Float4,
                },
                // A mat4 takes up 4 vertex slots as it is technically 4 vec4s. We need to define a slot
                // for each vec4. We don't have to do this in code though.
                // mat4 は技術的には 4 つの vec4 になるので 4 つの頂点スロットを使います。
                wgpu::VertexAttributeDescriptor {
                    offset: mem::size_of::<[f32; 4]>() as wgpu::BufferAddress,
                    shader_location: 6,
                    format: wgpu::VertexFormat::Float4,
                },
                wgpu::VertexAttributeDescriptor {
                    offset: mem::size_of::<[f32; 8]>() as wgpu::BufferAddress,
                    shader_location: 7,
                    format: wgpu::VertexFormat::Float4,
                },
                wgpu::VertexAttributeDescriptor {
                    offset: mem::size_of::<[f32; 12]>() as wgpu::BufferAddress,
                    shader_location: 8,
                    format: wgpu::VertexFormat::Float4,
                },
            ],
        }
    }
}
```

<!--
We need to add this descriptor to the render pipeline so that we can use it when we render.
-->
この descriptor をレンダリング時に使用するため render pipeline に追加する必要があります。

```rust
let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
    // ...
    vertex_state: wgpu::VertexStateDescriptor {
        index_format: wgpu::IndexFormat::Uint16,
        // UPDATED!
        vertex_buffers: &[Vertex::desc(), InstanceRaw::desc()],
    },
    // ...
});
```

<!--
Don't forget to return our new variables!
-->
新しい変数を return することを忘れないでください。

```rust
Self {
    // ...
    // NEW!
    instances,
    instance_buffer,
}
```

<!--
The last change we need to make is in the `render()` method. We need to bind our `instance_buffer` and we need to change the range we're using in `draw_indexed()` to include the number of instances.
-->
最後の変更は `render()` メソッドの中です。`instance_buffer` をバインドし、 `draw_indexed()` でつかうインスタンスの数の範囲を変更する必要があります。

```rust
render_pass.set_pipeline(&self.render_pipeline);
render_pass.set_bind_group(0, &self.diffuse_bind_group, &[]);
render_pass.set_bind_group(1, &self.uniform_bind_group, &[]);
render_pass.set_vertex_buffer(0, &self.vertex_buffer.slice(..));
// NEW!
render_pass.set_vertex_buffer(1, self.instance_buffer.slice(..));
render_pass.set_index_buffer(&self.index_buffer.slice(..));
// UPDATED!
render_pass.draw_indexed(0..self.num_indices, 0, 0..self.instances.len() as _);
```

<div class="warning">

<!--
Make sure if you add new instances to the `Vec`, that you recreate the `instance_buffer` and as well as `uniform_bind_group`, otherwise your new instances won't show up correctly.
-->

新しいインスタンスを `Vec` に追加したい時には `instance_buffer` と `uniform_bind_group` を再生成します。でなければ、新しいインスタンスが正しく表示されません。

</div>

<!--
We need to reference our new matrix in `shader.vert` so that we can use it for our instances. Add the following to the top of `shader.vert`.
-->
`shader.vert` で新しいマトリクスをインスタンスで利用するために、参照する必要があります。`shader.vert` のトップに以下のコードを追加してください。

```glsl
layout(location=5) in mat4 model_matrix;
```

<!--
We'll apply the `model_matrix` before we apply `u_view_proj`. We do this because the `u_view_proj` changes the coordinate system from `world space` to `camera space`. Our `model_matrix` is a `world space` transformation, so we don't want to be in `camera space` when using it.
-->
`u_view_proj` を適用する前に `model_matrix` を適用します。なぜなら `u_view_proj` は 座標系をワールド座標系からカメラ座標系に変更するからです。`model_matrix` はワールド座標系での変換なので、利用するときにカメラ座標系になっていてはいけません。

```glsl
void main() {
    v_tex_coords = a_tex_coords;
    // UPDATED!
    gl_Position = u_view_proj * model_matrix * vec4(a_position, 1.0);
}
```

<!--
With all that done, we should have a forest of trees!
-->
これらをすべて終えると、木の森が描かれます！

![./forest.png](./forest.png)

## Challenge

<!--
Modify the position and/or rotation of the instances every frame.
-->
インスタンスのポジションや角度を毎フレームごとに変えてみましょう。

<AutoGithubLink/>
