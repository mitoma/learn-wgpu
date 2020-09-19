# Buffers and Indices

<!--
## We're finally talking about them!
-->
## とうとう来ました
<!--
You were probably getting sick of me saying stuff like "we'll get to that when we talk about buffers". Well now's the time to finally talk about buffers, but first...
-->
多分あなたは「それは `Buffer` の項で書きます」にうんざりしていたでしょう。私たちはとうとう buffer について話す時が来ました。しかし最初に…

<!--
## What is a buffer?
-->
## buffer って何？
<!--
A buffer is a blob of data on the GPU. A buffer is guaranteed to be contiguous, meaning that all the data is stored sequentially in memory. Buffers are generally used to store simple things like structs or arrays, but it can store more complex stuff such as graph structures like trees (provided all the nodes are stored together and don't reference anything outside of the buffer). We are going to use buffers a lot, so let's get started with two of the most important ones: the vertex buffer, and the index buffer.
-->
buffer とは GPU の blob データです。(blob = Binary Large OBject)バッファは近接していることが保証され、それはすべてのデータがシーケンシャルにメモリに保存されているということを意味します。Buffer は一般的に構造体や配列のようにシンプルに保存されていますが、それはグラフ構造や木構造のように複雑に保存することもできます。(すべてのノードが一緒に保存されており、外部を参照しない場合です)これから多くの buffer を使いますが、その中でも2つの重要な buffer があります。一つは頂点バッファで、もう一つはインデックスバッファです。

<!--
## The vertex buffer
-->
## 頂点バッファ
<!--
Previously we've stored vertex data directly in the vertex shader. While that worked fine to get our bootstraps on, it simply won't do for the long-term. The types of objects we need to draw will vary in size, and recompiling the shader whenever we need to update the model would massively slow down our program. Instead we are going to use buffers to store the vertex data we want to draw. Before we do that though we need to describe what a vertex looks like. We'll do this by creating a new struct.
-->
前回は頂点シェーダの中に直接頂点データをおいていました。それは私たちの勉強の始まりにはちょうど良かったですが、長い目で見て意味がないやり方です。描こうとしているオブジェクトの形はサイズが大きく、モデルを更新しようとシェーダーを再コンパイルするプログラムは非常に遅くなるでしょう。代わりに描きたい頂点データを保存した buffer を使います。しかし、その前に頂点がどのように見えるかを説明をする必要があります。新しい構造体を作成します。

```rust
// main.rs
#[repr(C)]
#[derive(Copy, Clone, Debug)]
struct Vertex {
    position: [f32; 3],
    color: [f32; 3],
}
```

<!--
Our vertices will all have a position and a color. The position represents the x, y, and z of the vertex in 3d space. The color is the red, green, and blue values for the vertex. We need the `Vertex` to be copyable so we can create a buffer with it.
-->
頂点は位置と色を持ちます。位置は3次元空間上の頂点(x, y, z)を表し、色は座標の(red, green, blue)の値です。`Vertex` を buffer を作るためにコピー可能にしています。

<!--
Next we need the actual data that will make up our triangle. Below `Vertex` add the following.
-->
次に実際の三角形を作るためのデータが必要です。下記の `Vertex` を追加してください。

```rust
//main.rs
const VERTICES: &[Vertex] = &[
    Vertex { position: [0.0, 0.5, 0.0], color: [1.0, 0.0, 0.0] },
    Vertex { position: [-0.5, -0.5, 0.0], color: [0.0, 1.0, 0.0] },
    Vertex { position: [0.5, -0.5, 0.0], color: [0.0, 0.0, 1.0] },
];
```

<!--
We arrange the vertices in counter clockwise order: top, bottom left, bottom right. We do it this way partially out of tradition, but mostly because we specified in the `rasterization_state` of the `render_pipeline` that we want the `front_face` of our triangle to be `wgpu::FrontFace::Ccw` so that we cull the back face. This means that any triangle that should be facing us should have its vertices in counter clockwise order.
-->
私たちは頂点を反時計回りに配置しました。トップ、左下、右下。これは伝統的な順序と逆ですが、これは `render_pipeline`  の `rasterization_state` にある `front_face` で `wgpu::FrontFace::Ccw` を指定しているので時計回りだと後ろ向きになってカリングされてしまうからです。これはどんな三角形でも反時計回りの順序が表向きということを意味します。

<!--
Now that we have our vertex data, we need to store it in a buffer. Let's add a `vertex_buffer` field to `State`.
-->
これで頂点データが手に入ったので buffer に保存する必要があります。 `State` に `vertex_buffer` フィールドを追加しましょう。

```rust
// main.rs
struct State {
    // ...
    render_pipeline: wgpu::RenderPipeline,

    // NEW!
    vertex_buffer: wgpu::Buffer,

    // ...
}
```

<!--
Now let's create the buffer in `new()`.
-->
それではバッファを `new()` の中で作りましょう。

```rust
// new()
let vertex_buffer = device.create_buffer_with_data(
    bytemuck::cast_slice(VERTICES),
    wgpu::BufferUsage::VERTEX,
);
```

<!--
You'll note that we're using [bytemuck](https://docs.rs/bytemuck/1.2.0/bytemuck/) to cast our `VERTICES`. The `create_buffer_with_data()` method expects a `&[u8]`, and `bytemuck::cast_slice` does that for us. Add the following to your `Cargo.toml`.
-->
[bytemuck](https://docs.rs/bytemuck/1.2.0/bytemuck/) を使って `VERTICES` をキャストしていることに気づくでしょう。`create_buffer_with_data()` は `&[u8]` を期待していて `bytemuck::cast_slice` はそれを返します。`Cargo.toml` に以下を追加しましょう。

```toml
bytemuck = "1.2.0"
```

<!--
We're also going to need to implement two traits to get `bytemuck` to work. These are [bytemuck::Pod](https://docs.rs/bytemuck/1.2.0/bytemuck/trait.Pod.html) and [bytemuck::Zeroable](https://docs.rs/bytemuck/1.2.0/bytemuck/trait.Zeroable.html). `Pod` indicates that our `Vertex` is "Plain Old Data", and thus can be interpretted as a `&[u8]`. `Zeroable` indicates that we can use `std::mem::zeroed()`. These traits don't require us to implement any methods, so we just need to use the following to get our code to work.
-->
`bytemuck` を機能させるために二つのトレイトを実装する必要があります。それは [bytemuck::Pod](https://docs.rs/bytemuck/1.2.0/bytemuck/trait.Pod.html) と [bytemuck::Zeroable](https://docs.rs/bytemuck/1.2.0/bytemuck/trait.Zeroable.html) です。`Pod` は `Vertex` が "Plain Old Data" であるということを表します。これのおかげで `&[u8]` として読み取ることができるわけです。`Zeroable` は `std::mem::zeroed()` を使えることを表します。これらのトレイトはメソッドを実装する必要はありませんので、以下のように追記する必要があるだけです。

```rust
unsafe impl bytemuck::Pod for Vertex {}
unsafe impl bytemuck::Zeroable for Vertex {}
```

<!--
Finally we can add our `vertex_buffer` to our `State` struct.
-->
最終的に `vertex_buffer` が `State` に追加されました。

```rust
Self {
    surface,
    device,
    queue,
    sc_desc,
    swap_chain,
    render_pipeline,
    vertex_buffer,
    size,
}
```

<!--
## So what do I do with it?
-->
## それで、どうしたらいい？
<!--
We need to tell the `render_pipeline` to use this buffer when we are drawing, but first we need to tell the `render_pipeline` how to read the buffer. We do this using `VertexBufferDescriptor`s and the `vertex_buffers` field that I promised we'd talk about when we created the `render_pipeline`.
-->
`render_pipeline` にこのバッファを描画時に使うということを教える必要がありますが、最初に `render_pipeline` にどのようにこのバッファを読めばいいか教える必要があります。`render_pipeline` を作るときに説明することを約束していた `VertexBufferDescriptor` と `vertex_buffers` を使います。

<!--
A `VertexBufferDescriptor` defines how a buffer is layed out in memory. Without this, the render_pipeline has no idea how to map the buffer in the shader. Here's what the descriptor for a buffer full of `Vertex` would look like.
-->
`VertexBufferDescriptor` は buffer のメモリ上レイアウトを定義します。これなしには、 `render_pipeline` はどのようにシェーダーで buffer の中身を読めばいいかわかりません。これは `Vertex` 全体をどのように見ればいいかの記述です。

```rust
use std::mem;
wgpu::VertexBufferDescriptor {
    stride: mem::size_of::<Vertex>() as wgpu::BufferAddress, // 1.
    step_mode: wgpu::InputStepMode::Vertex, // 2.
    attributes: &[ // 3.
        wgpu::VertexAttributeDescriptor {
            offset: 0, // 4.
            shader_location: 0, // 5.
            format: wgpu::VertexFormat::Float3, // 6.
        },
        wgpu::VertexAttributeDescriptor {
            offset: mem::size_of::<[f32; 3]>() as wgpu::BufferAddress,
            shader_location: 1,
            format: wgpu::VertexFormat::Float3,
        }
    ]
}
```

<!--
1. The `stride` defines how wide a vertex is. When the shader goes to read the next vertex, it will skip over `stride` number of bytes. In our case, stride will probably be 24 bytes.
2. `step_mode` tells the pipeline how often it should move to the next vertex. This seems redundant in our case, but we can specify `wgpu::InputStepMode::Instance` if we only want the change vertices when we start drawing a new instance. We'll cover instancing in a later tutorial.
3. Vertex attributes describe the individual parts of the vertex. Generally this is a 1:1 mapping with a structs fields which it is in our case.
4. This defines the `offset` in bytes that this attribute starts. The first attribute is usually zero, and any future attributes are the collective `size_of` the previous attributes data.
5. This tells the shader what location to store this attribute at. For example `layout(location=0) in vec3 x` in the vertex shader would correspond to the position field of the struct, while `layout(location=1) in vec3 x` would be the color field.
6. `format` tells the shader the shape of the attribute. `Float3` corresponds to `vec3` in shader code. The max value we can store in an attribute is `Float4` (`Uint4`, and `Int4` work as well). We'll keep this in mind for when we have to store things that are bigger than `Float4`.
-->
1. `stride` は頂点データのサイズを指定します。シェーダーが次の頂点データを読み込もうとするとき、 `stride` で指定した数分だけバイトをスキップします。このケースではおそらく `stride` は24バイトになるでしょう。
2. `step_mode` は次の頂点データを読み込むときにどのように動くかを pipeline に教えます。私たちのケースでは冗長に見えますが、もし次の頂点は別のインスタンスの頂点が欲しい場合には `wgpu::InputStepMode::Instance` を指定することができます。インスタンシングについては後のチュートリアルでカバーします。
3. 頂点アトリビュートは頂点の独立した部分を記述します。一般的には構造体のフィールドに1対1対応しますし、今回のケースもそうです。
4. `offset` はアトリビュートがバイト列のどこから開始されるかを定義します。最初のアトリビュートは大抵0で、後続のアトリビュートは先行するアトリビュートの `size_of` の和になります。
5. これはアトリビュートがシェーダーにおけるロケーションがどこかになるかを指定します。例として `layout(location=0) in vec3 x` が頂点シェーダにあればそれに対応し、`layout(location=1) in vec3 x` は color フィールドに対応します。
6. `format` はアトリビュートの形をシェーダーに教えます。`Float3` はシェーダーでは `vec3` に対応います。保存できるアトリビュートの最大は `Float4` です。(`Uint4` と `Int4` も同様に機能します) `Float4` より大きいものを格納する必要があるときはこのことを覚えておく必要があります。

<!--
For you visually learners, our vertex buffer looks like this.
-->
視覚的に見るならば、私たちの頂点バッファはこのような感じです。

![A figure of the VertexBufferDescriptor](./vb_desc.png)


<!--
Let's create a static method on `Vertex` that returns this descriptor. Thankfully, wgpu provides us with a convenient macro for doing this! `vertex_attr_array!` expands into an array of descriptors with automatically calculated offsets.
-->
`Vertex` に Descriptor を返す static メソッドを作ります。ありがたいことに wgpu はこのために便利なマクロを提供しています。`vertex_attr_array!` は discriptor の配列に自動でオフセットを計算して展開してくれます。

```rust
// main.rs
impl Vertex {
    fn desc<'a>() -> wgpu::VertexBufferDescriptor<'a> {
        wgpu::VertexBufferDescriptor {
            stride: std::mem::size_of::<Vertex>() as wgpu::BufferAddress,
            step_mode: wgpu::InputStepMode::Vertex,
            attributes: &wgpu::vertex_attr_array![0 => Float3, 1 => Float3],
        }
    }
}
```

<!--
Now we can use it when we create the `render_pipeline`.
-->
これで `render_pipeline` を作る時に頂点バッファを使えます。

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
One more thing: we need to actually set the vertex buffer in the render method otherwise our program will crash.
-->
もう一つ、実際に頂点バッファセットする処理を `render()` に書いておかないとプログラムがクラッシュしてしまいます。

```rust
// render()
render_pass.set_pipeline(&self.render_pipeline);
// NEW!
render_pass.set_vertex_buffer(0, &self.vertex_buffer, 0, 0);
render_pass.draw(0..3, 0..1);
```

<!--
Before we continue, we should change the `render_pass.draw()` call to use the number of vertices specified by `VERTICES`. Add a `num_vertices` to `State`, and set it to be equal to `VERTICES.len()`.
-->
先を続ける前に、`render_pass.draw()` を呼び出すときに頂点数は `VERTICES` から取るべきでしょう。`State` に `num_vertices` を追加し、 `VERTICES.len()` の結果をセットします。

```rust
// main.rs

struct State {
    // ...
    num_vertices: u32,
}

impl State {
    // ...
    fn new(...) -> Self {
        // ...
        let num_vertices = VERTICES.len() as u32;

        Self {
            surface,
            device,
            queue,
            sc_desc,
            swap_chain,
            render_pipeline,
            vertex_buffer,
            num_vertices,
            size,
        }
    }
}
```

<!--
Then use it in the draw call.
-->
draw を呼び出すときにそれを使います。

```rust
// render
render_pass.draw(0..self.num_vertices, 0..1);
```

<!--
Before our changes will have any effect, we need to update our vertex shader to get its data from the vertex buffer.
-->
この変更を確認する前に、頂点シェーダを変更して頂点バッファからデータを取得するようにします。

```glsl
// shader.vert
#version 450

layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_color;

layout(location=0) out vec3 v_color;

void main() {
    v_color = a_color;
    gl_Position = vec4(a_position, 1.0);
}
```

<!--
We'll want to update the fragment shader to use `v_color` as well.
-->
フラグメントシェーダーも `v_color` を使うように修正します。

```glsl
// shader.frag
#version 450

layout(location=0) in vec3 v_color;
layout(location=0) out vec4 f_color;

void main() {
    f_color = vec4(v_color, 1.0);
}
```

<!--
If you've done things correctly, you should see a triangle that looks something like this.
-->
もしこれを正確に行えば、以下のような三角形が表示されます。

![A colorful triangle](./triangle.png)

<!--
## The index buffer
-->
## インデックスバッファ
<!--
We technically don't *need* an index buffer, but they still are plenty useful. An index buffer comes into play when we start using models with a lot of triangles. Consider this pentagon.
-->
技術的にはインデックスバッファというものは不要ですが、これはまだ非常に有用なものです。インデックスバッファは、たくさんの三角形を用いてモデルを作り始めると有効に作用し始めます。五角形について考えみみましょう。

![A pentagon made of 3 triangles](./pentagon.png)

<!--
It has a total of 5 vertices, and 3 triangles. Now if we wanted to display something like this using just vertices we would need something like the following.
-->
これは5つの頂点と3つのトライアングルです。今、これらを頂点バッファのみを利用して描画しようとすると以下のようになります。

```rust
const VERTICES: &[Vertex] = &[
    Vertex { position: [-0.0868241, 0.49240386, 0.0], color: [0.5, 0.0, 0.5] }, // A
    Vertex { position: [-0.49513406, 0.06958647, 0.0], color: [0.5, 0.0, 0.5] }, // B
    Vertex { position: [0.44147372, 0.2347359, 0.0],color: [0.5, 0.0, 0.5] }, // E

    Vertex { position: [-0.49513406, 0.06958647, 0.0], color: [0.5, 0.0, 0.5] }, // B
    Vertex { position: [-0.21918549, -0.44939706, 0.0], color: [0.5, 0.0, 0.5] }, // C
    Vertex { position: [0.44147372, 0.2347359, 0.0],color: [0.5, 0.0, 0.5] }, // E

    Vertex { position: [-0.21918549, -0.44939706, 0.0], color: [0.5, 0.0, 0.5] }, // C
    Vertex { position: [0.35966998, -0.3473291, 0.0], color: [0.5, 0.0, 0.5] }, // D
    Vertex { position: [0.44147372, 0.2347359, 0.0],color: [0.5, 0.0, 0.5] }, // E
];
```

<!--
You'll note though that some of the vertices are used more than once. C, and B get used twice, and E is repeated 3 times. Assuming that each float is 4 bytes, then that means of the 216 bytes we use for `VERTICES`, 96 of them are duplicate data. Wouldn't it be nice if we could list these vertices once? Well we can! That's were an index buffer comes into play.
-->
あなたはいくつかの頂点が一回以上使われていることに気づくでしょう。B と C が二回使われており E は三回使われています。float が4バイトだと仮定すると、`VERTICES` は216バイト消費し、そのうちの96バイトは重複したデータです。これはあまりよくないので、それらの頂点を一度だけ書くようにできないか？できます。インデックスバッファが有効に作用します。

<!--
Basically we store all the unique vertices in `VERTICES` and we create another buffer that stores indices to elements in `VERTICES` to create the triangles. Here's an example of that with our pentagon.
-->
基本的に、`VERTICES` にはすべてのユニークな頂点だけを格納し、別のバッファを作り `VERTICES` の要素で三角形を作るインデックスを保存します。これは五角形の例です。

```rust
// main.rs
const VERTICES: &[Vertex] = &[
    Vertex { position: [-0.0868241, 0.49240386, 0.0], color: [0.5, 0.0, 0.5] }, // A
    Vertex { position: [-0.49513406, 0.06958647, 0.0], color: [0.5, 0.0, 0.5] }, // B
    Vertex { position: [-0.21918549, -0.44939706, 0.0], color: [0.5, 0.0, 0.5] }, // C
    Vertex { position: [0.35966998, -0.3473291, 0.0], color: [0.5, 0.0, 0.5] }, // D
    Vertex { position: [0.44147372, 0.2347359, 0.0],color: [0.5, 0.0, 0.5] }, // E
];

const INDICES: &[u16] = &[
    0, 1, 4,
    1, 2, 4,
    2, 3, 4,
];
```

<!--
Now with this setup our `VERTICES` take up about 120 bytes and `INDICES` is just 18 bytes given that `u16` is 2 bytes wide. All together our pentagon is 132 bytes in total. That means we saved 84 bytes! It may not seem like much, but when dealing with tri counts in the hundreds of thousands, indexing saves a lot of memory.
-->
これで `VERTICES` は120バイトになり `INDICES` はu16が2バイト幅なので18バイトになりました。合わせると五角形全体で132バイトになるので、84バイト減せました。もしかしたら意味あることに見えないかもしれませんが、三角形の数が非常に大きくなるとインデックスは多くのメモリ消費を抑えることができます。

<!--
There's a couple of things we need to change in order to use indexing. The first is we need to create a buffer to store the indices. In `State`'s `new()` method create the `index_buffer` after you create the `vertex_buffer`. Also change `num_vertices` to `num_indices` and set it equal to `INDICES.len()`.
-->
インデックスを利用するためにいくつか一緒に変更しなければいけないことがあります。一つはバッファを作成してインデックスを保存することです。`State` の `new()` メソッドで `index_buffer` を `vertex_buffer` の後に生成しましょう。また `num_vertices` を `num_indices` に変更し `INDICES.len()` を渡すようにしましょう。

```rust
let vertex_buffer = device.create_buffer_with_data(
    bytemuck::cast_slice(VERTICES),
    wgpu::BufferUsage::VERTEX,
);
// NEW!
let index_buffer = device.create_buffer_with_data(
    bytemuck::cast_slice(INDICES),
    wgpu::BufferUsage::INDEX,
);
let num_indices = INDICES.len() as u32;
```

<!--
We don't need to implement `Pod` and `Zeroable` for our indices, because `bytemuck` has already done that for us. That means we can just add `index_buffer` and `num_indices` to `State`.
-->
`Pod` と `Zeroable` を indices に実装する必要はありません。`bytemuck` はすでにそれを行っているからです。つまり `State` に `index_buffer` と `num_indices` を追加します。

```rust
Self {
    surface,
    device,
    queue,
    sc_desc,
    swap_chain,
    render_pipeline,
    vertex_buffer,
    // NEW!
    index_buffer,
    num_indices,
    size,
}
```

<!--
All we have to do now is update the `render()` method to use the `index_buffer`.
-->
`render()` メソッドも `index_buffer` を使うよう修正するのが、今やらなければいけないすべてです。

```rust
// render()
render_pass.set_vertex_buffer(0, &self.vertex_buffer, 0, 0);
render_pass.set_index_buffer(&self.index_buffer, 0, 0); // 1.
render_pass.draw_indexed(0..self.num_indices, 0, 0..1); // 2.
```

<!--
A couple things to note:
1. The method name is `set_index_buffer` not `set_index_buffers`. You can only have one index buffer set at a time.
2. When using an index buffer, you need to use `draw_indexed`. The `draw` method ignores the index buffer. Also make sure you use the number of indices (`num_indices`), not vertices as you model will either draw wrong, or the method will `panic` because there are not enough indices. Last thing to note about this method is that the second parameter specifies what index to start at in the buffer. This could allow you to store multiple sets of indices in one buffer. The last parameter is the size of the buffer. Passing 0 tells wgpu to use the entire buffer.
-->
注意すべき点
1. メソッド名は `set_index_buffer` であり `set_index_buffers` ではありません。同時ひ一つのインデックスバッファしか持つことができません。
2. インデックスバッファを使うとき `draw_indexed` を使う必要があります。`draw` メソッドはインデックスバッファを無視します。頂点ではなくインデックスの数(`num_indices`)を使わないと、モデルが間違って描画されるか十分なインデックスがないためパニックします。最後に、このメソッドの二つ目のパラメータはインデックスバッファの開始位置を指定します。これは一つのインデックスバッファに複数のセットを保存できるということです。最後のパラメータはバッファのサイズです。0を渡すと `wgpu` はすべてのバッファを使用します。

<!--
With all that you should have a garishly magenta pentagon in your window.
-->
すべて実行するとマゼンタの派手な五角形がウインドウに出てきます。

![Magenta pentagon in window](./indexed-pentagon.png)

## Challenge
<!--
Create a more complex shape than the one we made (aka. more than three triangles) using a vertex buffer and an index buffer. Toggle between the two with the space key.
-->
頂点バッファとインデックスバッファを使って私たちが作ったのより複雑な形を作ってみましょう。(3つ以上の三角形をもつもの)そしてそれらをスペースキーを押すと切り替わるようにしてみましょう。

<AutoGithubLink/>
