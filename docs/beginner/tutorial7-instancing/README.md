# Instancing

<!--
Our scene right now is very simple: we have one object centered at (0,0,0). What if we wanted more objects? This is were instancing comes in. 
-->
シーンは今のところとてもシンプルです。オブジェクトは (0, 0, 0) の中心に置かれています。もし多数のオブジェクトを置きたいときにはどうすればいいでしょう。インスタンシングの出番です。

<!--
Instancing allows use to draw the same object multiple times with different properties (position, orientation, size, color, etc.). There are multiple ways of doing instancing. One way would be to modify the uniform buffer to include these properties and then update it before we draw each instance of our object.
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
The `instances` parameter takes a `Range<u32>`. This parameter tells the GPU how many copies, or instances, of our model we want to draw. Currently we are specifying `0..1`, which the GPU will draw our model once, and then it will stop. If we used `0..5`, our code would draw 5 instances.
-->
`instances` パラメータは `Range<u32`> をとります。このパラメータは GPU にモデルを描画するのに何回コピーするか、あるいはいくつインスタンスがあるかを教えます。現在、 `0..1` の間でしか渡していませんのでモデルは一回しか書かれずに終わってしまいます。もし `0..5` なら 5 インスタンス描画されます。

<!--
The fact that `instances` is a `Range<u32>` may seem weird as using `1..2` for instances would still draw 1 instance of our object. Seems like it would be simpler to just use a `u32` right? The reason it's a range is because sometimes we don't want to draw **all** of our objects. Sometimes we want to draw a selection of them, because others are not in frame, our we are debugging and want to look at a particular set of instances.
-->
実際には `instances` は `Range<u32>` として `1..2` という奇妙な値を渡すこともありますが、これも 1 インスタンスの描画になります。`u32` を単に渡したほうがシンプルだと思いますか？range を使っている理由は、しばしば **全ての** オブジェクトを描画したくないケースがあるからです。例えばほかのものはフレームから外れていたり、特定のインスタンスの集まりデバックしたいケースでは、それらのうち選択されたものだけを描画したくなります。

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
#[derive(Copy, Clone)]
struct InstanceRaw {
    model: cgmath::Matrix4<f32>,
}

unsafe impl bytemuck::Pod for InstanceRaw {}
unsafe impl bytemuck::Zeroable for InstanceRaw {}
```

<!--
This is the data to will go into the `wgpu::Buffer`. We keep these separate so that we can update the `Instance` as much as we want without needing to mess with matrices. We only need to update the raw data before we draw.
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
            model: cgmath::Matrix4::from_translation(self.position) * cgmath::Matrix4::from(self.rotation),
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
    #[allow(dead_code)]
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
// we'll need the size for later
// 後で size が必要になります。
let instance_buffer_size = instance_data.len() * std::mem::size_of::<cgmath::Matrix4<f32>>();
let instance_buffer = device.create_buffer_with_data(
    bytemuck::cast_slice(&instance_data),
    wgpu::BufferUsage::STORAGE_READ,
);
```

<!--
We need a way to bind our new instance buffer so we can use it in the vertex shader. We could create a new bind group (and we probably should), but for simplicity, I'm going to add a binding to the `uniform_bind_group` that references our `instance_buffer`.
-->
新しい `instance_buffer` を頂点シェーダで使えるようにするために bind する方法が必要です。新しい bind group を作ることもできますし、たぶんそうすべきですが、簡単のためにここでは `uniform_bind_group` が `instance_buffer` を参照するようにします。

```rust
let uniform_bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
    bindings: &[
        // ...
        // NEW!
        wgpu::BindGroupLayoutEntry {
            binding: 1,
            visibility: wgpu::ShaderStage::VERTEX,
            ty: wgpu::BindingType::StorageBuffer {
                // We don't plan on changing the size of this buffer
                // buffer size の変更は考えていないので false を指定。
                dynamic: false,
                // The shader is not allowed to modify it's contents
                // shader にはコンテンツの変更を許可しないので true
                readonly: true,
            },
        },
    ],
    label: Some("uniform_bind_group_layout"),
});

let uniform_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
    layout: &uniform_bind_group_layout,
    bindings: &[
        // ...
        // NEW!
        wgpu::Binding {
            binding: 1,
            resource: wgpu::BindingResource::Buffer {
                buffer: &instance_buffer,
                range: 0..instance_buffer_size as wgpu::BufferAddress,
            }
        },
    ],
    label: Some("uniform_bind_group"),
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
The last change we need to make is in the `render()` method. We need to change the range we're using in `draw_indexed()` to include use the number of instances.
-->
最後の変更は `render()` メソッドの中です。 `draw_indexed()` でつかうインスタンスの数の範囲を変更します。

```rust
render_pass.set_pipeline(&self.render_pipeline);
render_pass.set_bind_group(0, &self.diffuse_bind_group, &[]);
render_pass.set_bind_group(1, &self.uniform_bind_group, &[]);
render_pass.set_vertex_buffer(0, &self.vertex_buffer, 0, 0);
render_pass.set_index_buffer(&self.index_buffer, 0, 0);
// UPDATED!
render_pass.draw_indexed(0..self.num_indices, 0, 0..self.instances.len() as _);
```

<div class="warning">

<!--
Make sure if you add new instances to the `Vec` that you recreate the `instance_buffer` and as well as `uniform_bind_group`, otherwise you're new instances won't show up correctly.
-->
新しいインスタンスを `Vec` に追加したい時には `instance_buffer` と `uniform_bind_group` を再生成します。でなければ、新しいインスタンスが正しく表示されません。

</div>

## Storage Buffers

<!--
When we modified `uniform_bind_group_layout`, we specified that our `instance_buffer` would be of type `wgpu::BindingType::StorageBuffer`. A storage buffer functions like an array that persists between shader invocations. Let's take a look at what it looks like in `shader.vert`.
-->
`uniform_bind_group_layout` を変更したとき `instance_buffer` を `wgpu::BindingType::StorageBuffer` という型で作りました。Storage Buffer の機能は配列に似ており、shader 呼び出しの間永続化されています。`shader.vert` の中でそれがどのようになっているか見てみましょう。

```glsl
layout(set=1, binding=1) 
buffer Instances {
    mat4 s_models[];
};
```

<!--
We declare a storage buffer in a very similar way to how we declare a uniform block. The only real difference is that we use the `buffer` keyword. We can then use `s_models` to position our models in the scene. But how do we know what instance to use?
-->
Strage Buffer を uniform ブロックととても似た方法で宣言しました。実際、変更点は `buffer` というキーワードだけです。`s_models` をモデルの位置として使うことができます。しかし、どのようししてどのインスタンスを使っているか知ることができるでしょう？

## gl_InstanceIndex

<!--
This GLSL variable let's use specify what instance we want to use. We can use the `gl_InstanceIndex` to index our `s_models` buffer to get the matrix for the current model.
-->
この GLSL の変数はこれから使おうとしているインスタンスがどれかをはっきりさせてくれます。`gl_InstanceIndex` を使うことで現在のモデルのインデックスがわかり、 `s_models` buffer から行列を取得する事ができます。

```glsl
void main() {
    v_tex_coords = a_tex_coords;
    // UPDATED!
    gl_Position = u_view_proj * s_models[gl_InstanceIndex] * vec4(a_position, 1.0);
}
```

<div class="note">

<!--
The value of `gl_InstanceIndex` is based on the range passed to the `instances` parameter of `draw_indexed`. Using `3..instances.len() as _` would mean that the 1st-3rd instances would be skipped.
-->
`gl_InstanceIndex` の値は `draw_indexed` のインスタンスパラメータで渡した値に基づいています。`3..instances.len() as _` を渡した場合、1～3番目のインスタンスはスキップされます。

</div>

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
