# The Pipeline

<!--
## What's a pipeline?
-->
## pipeline とは何ですか？
<!--
If you're familiar with OpenGL, you may remember using shader programs. You can think of a pipeline as a more robust version of that. A pipeline describes all the actions the gpu will preform when acting on a set of data. In this section, we will be creating a `RenderPipeline` specifically.
-->
もし OpenGL になじみがあれば、シェーダープログラムのことを思い出すかもしれません。pipeline についてはそれの頑強なバージョンだと考えることができます。pipeline は GPU がデータを受け取ったときに行うアクションすべてを表現するものです。このセクションでは `RdenderPipeline` を具体的に作っていきます。

<!--
## Wait shaders?
-->
## 待って、シェーダーって？
<!--
Shaders are mini programs that you send to the gpu to perform operations on your data. There are 3 main types of shader: vertex, fragment, and compute. There are others such as geometry shaders, but they're more of an advanced topic. For now we're just going to use vertex, and fragment shaders.
-->
シェーダーとはデータを処理するために GPU に送信される小さなプログラムです。シェーダーには大きく3つのタイプがあります。頂点シェーダー、フラグメントシェーダー、コンビュートシェーダーです。他にもジオメトリシェーダーなどもありますが、これはより進んだトピックになります。今は頂点シェーダーとフラグメントシェーダーについて扱います。

<!--
## Vertex, fragment.. what are those?
-->
## 頂点、フラグメント…。それは何ですか？
<!--
A vertex is a point in 3d space (can also be 2d). These vertices are then bundled in groups of 2s to form lines and/or 3s to form triangles.
-->
頂点とは三次元空間における(または二次元空間における)点です。頂点は2つの組で線を形づくり、3つの組で三角を形づくります。

<img src="./tutorial3-pipeline-vertices.png" />

<!--
Most modern rendering uses triangles to make all shapes, from simple (such as cubes) to complex (such as people).
-->
ほとんどの現代的なレンダリングでは、簡単なもの(例えば立方体)から複雑なもの(例えば人々)まで三角形ですべて構成されています。

<!-- Todo: Find/make an image to put here -->

<!--
We use a vertex shader to manipulate a list of vertices, in order to transform the shape to look the way we want it.
-->
私たちは頂点シェーダー使うことですべての頂点を操作し、やりたいように変形したりします。

<!--
You can think of a fragment as the beginnings of a pixel in the resulting image. Each fragment has a color that will be copied to its corresponding pixel. The fragment shader decides what color the fragment will be.
-->
フラグメントの事は、最初は結果イメージの各ピクセルの事だと考えることができます。それぞれのフラグメントは対応するピクセルにコピーされる色を持っています。フラグメントシェーダーはフラグメントがどの色になるか決定します。

<!--
## GLSL and SPIR-V
-->
## GLSL と SPIR-V
<!--
Shaders in `wgpu` are written with a binary language called [SPIR-V](https://www.khronos.org/registry/spir-v/). SPIR-V is designed for computers to read, not people, so we're going to use a language called GLSL to write our code, and then convert that to SPIR-V.
-->
`wgpu` におけるシェーダーは [SPIR-V](https://www.khronos.org/registry/spir-v/) と呼ばれるバイナリ言語で書かれています。SPIR-V はコンピュータ可読にデザインされており、人間が読むものではないので、GLSL という言語でコードを書き SPIR-V にコンバートします。

<!--
In order to do that, we're going to need something to do the conversion. Add the following crate to your dependencies.
-->
それをするためには少し変更点があります。crate の依存に追加するのものがあるのです。

```toml
[dependencies]
# ...
shaderc = "0.6"
```

<!--
We'll use this in a bit, but first let's create the shaders.
-->
これを少し使って最初にシェーダーを作ってみましょう。

<!--
## Writing the shaders
-->
## シェーダーを書く
<!--
In the same folder as `main.rs`, create two (2) files: `shader.vert`, and `shader.frag`. Write the following code in `shader.vert`.
-->
`main.rs` と同じフォルダに `shader.vert` と `sharder.flag` という 2 つのファイルを作りましょう。`sharder.vert` は次のような感じです。

```glsl
// shader.vert
#version 450

const vec2 positions[3] = vec2[3](
    vec2(0.0, 0.5),
    vec2(-0.5, -0.5),
    vec2(0.5, -0.5)
);

void main() {
    gl_Position = vec4(positions[gl_VertexIndex], 0.0, 1.0);
}
```

<!--
If you've used C/C++ before (or even Java), this syntax should be somewhat familiar. There are some key differences though that i'll go over.
-->
もし C/C++ や Java を以前使ったことがあればこの文法はいくらか親しみがあるでしょう。後で説明しますがいくつか重要な違いがあります。

<!--
First up there's the `#version 450` line. This specifies the version of GLSL that we're using. I've gone with a later version so we can use many of the advanced GLSL features.
-->
最初に `#version 450` という行があります。これは使用する GLSL のバージョンを明確にしています。いくつかこのバージョン以降のアドバンスドな GLSL の機能を使います。

<!--
We're currently storing vertex data in the shader as `positions`. This is bad practice as it limits what we can draw with this shader, and it can make the shader super big if we want to use a complex model. Using actual vertex data requires us to use `Buffer`s, which we'll talk about next time, so we'll turn a blind eye for now.
-->
現時点ではシェーダーの中に頂点の情報を `positions` として保存しています。これはシェーダーに何か描画させるときにはよくないやり方で、複雑なモデルを描こうとするとシェーダーが非常に大きくなってしまいます。実際の頂点データを使うときには `Buffer` を使いますし、それは次回説明しますが、今は目をつぶりましょう。

<!--
There's also `gl_Position` and `gl_VertexIndex` which are built-in variables that define where the vertex position data is going to be stored as 4 floats, and the index of the current vertex in the vertex data.
-->
`gl_Position` と `gl_VertexIndex` はビルトインの変数で、 `gl_Position` は座標の位置を表す4つのfloatの値を保存し、`gl_vertexIndex` は座標のデータのうち現在の座標のindexを表しています。

<!--
Next up `shader.frag`.
-->
次に `shader.flag` を見てみましょう。

```glsl
// shader.frag
#version 450

layout(location=0) out vec4 f_color;

void main() {
    f_color = vec4(0.3, 0.2, 0.1, 1.0);
}
```

<!--
The part that sticks out is the `layout(location=0) out vec4 f_color;` line. In GLSL you can create `in` and `out` variables in your shaders. An `in` variable will expect data from outside the shader. In the case of the vertex shader, this will come from vertex data. In a fragment shader, an `in` variable will pull from `out` variables in the vertex shader. When an `out` variable is defined in the fragment shader, it means that the value is meant to be written to a buffer to be used outside the shader program.
-->
ここで突出しているのは `layout(location=0) out vec4 f_color;` という行でしょう。GLSL ではシェーダー内に `in` 変数と `out` 変数を作ります。`in` 変数はシェーダーの外から渡されるデータを期待しています。頂点シェーダーにおいては頂点データが渡されます。フラグメントシェーダーでは頂点シェーダーの `out` 変数として出力されたデータが `in` 変数として取られます。フラグメントシェーダーで `out` 変数が定義されるとき、その値はシェーダープログラムの外で使われる値ということを意味します。

<!--
`in` and `out` variables can also specify a layout. In `shader.frag` we specify that the `out vec4 f_color` should be `layout(location=0)`; this means that the value of `f_color` will be saved to whatever buffer is at location zero in our application. In most cases, `location=0` is the current texture from the swapchain aka the screen.
-->
`in` と `out` の変数はレイアウトも明記します。`sharder.flag` では `out vec4 f_clolor` は `layout(location=0)` と記述されており、`f_color` は私たちのアプリケーションの0番目の位置のバッファに保存されます。ほとんどのケースでは `location=0` は swapchain の現在の texture 、すなわちスクリーンです。

<!--
You may have noticed that `shader.vert` doesn't have any `in` variables nor `out` variables. `gl_Position` functions as an out variable for vertex position data, so `shader.vert` doesn't need any `out` variables. If we wanted to send more data to fragment shader, we could specify an `out` variable in `shader.vert` and an in variable in `shader.frag`. *Note: the location has to match, otherwise the GLSL code will fail to compile*
-->
`sharder.vert` は `in` 変数も `out` 変数も持っていないことに気づくかもしれません。 `gl_Position` は頂点位置データの出力するための変数ときて機能するので `sharder.vert` では出力変数を必要としません。もし、フラグメントシェーダーに座標データ以外のほかの変数を渡したい場合に `shader.vert` に `out` 変数を定義してやり `shader.flag` に `in` 変数を定義してやります。
Note: location が一致しないと GLSL コードはコンパイルに失敗します。

```glsl
// shader.vert
layout(location=0) out vec4 v_color;

// shader.frag
layout(location=0) in vec4 v_color;
```

<!--
## How do we use the shaders?
-->
## シェーダーはどのように使うか
<!--
This is the part where we finally make the thing in the title: the pipeline. First let's modify `State` to include the following.
-->
このパートで最終的に成し遂げることは、pipline の構築です。最初に `State` を修正しましょう。

```rust
// main.rs
struct State {
    surface: wgpu::Surface,
    device: wgpu::Device,
    queue: wgpu::Queue,
    sc_desc: wgpu::SwapChainDescriptor,
    swap_chain: wgpu::SwapChain,

    // NEW!
    render_pipeline: wgpu::RenderPipeline,

    size: winit::dpi::PhysicalSize<u32>,
}
```

<!--
Now let's move to the `new()` method, and start making the pipeline. We'll have to load in those shaders we made earlier, as the `render_pipeline` requires those.
-->
pipeline を作るために最初に `new()` を見ていきましょう。`render_pipeline` にはシェーダーが必要なので、それを作る前にシェーダーをロードしなければいけません。

```rust
let vs_src = include_str!("shader.vert");
let fs_src = include_str!("shader.frag");

let mut compiler = shaderc::Compiler::new().unwrap();
let vs_spirv = compiler.compile_into_spirv(vs_src, shaderc::ShaderKind::Vertex, "shader.vert", "main", None).unwrap();
let fs_spirv = compiler.compile_into_spirv(fs_src, shaderc::ShaderKind::Fragment, "shader.frag", "main", None).unwrap();

let vs_data = wgpu::read_spirv(std::io::Cursor::new(vs_spirv.as_binary_u8())).unwrap();
let fs_data = wgpu::read_spirv(std::io::Cursor::new(fs_spirv.as_binary_u8())).unwrap();

let vs_module = device.create_shader_module(&vs_data);
let fs_module = device.create_shader_module(&fs_data);
```

<!--
One more thing, we need to create a `PipelineLayout`. We'll get more into this after we cover `Buffer`s.
-->
もう一つ、 `PipelineLayout` も作らないといけません。これは後で `Buffer` を作るときに必要になってきます。

```rust
let render_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
    bind_group_layouts: &[],
});
```

<!--
Finally we have all we need to create the `render_pipeline`.
-->
最終的に私たちが必要な `render_pipeline` は以下のようになります。

```rust
let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
    layout: &render_pipeline_layout,
    vertex_stage: wgpu::ProgrammableStageDescriptor {
        module: &vs_module,
        entry_point: "main", // 1.
    },
    fragment_stage: Some(wgpu::ProgrammableStageDescriptor { // 2.
        module: &fs_module,
        entry_point: "main",
    }),
```

<!--
Two things to note here:
1. Here you can specify which function inside of the shader should be called, which is known as the `entry_point`. I normally use `"main"` as that's what it would be in OpenGL, but feel free to use whatever name you like. Make sure you specify the same entry point when you're compiling your shaders as you do here where you're exposing them to your pipeline.
2. The `fragment_stage` is technically optional, so you have to wrap it in `Some()`. I've never used a vertex shader without a fragment shader, but the option is available if you need it.
-->
2点注意事項があります。
1. シェーダーの `entry_point` を明記する必要があります。私はたいてい OpenGL では `main` を使っていました。しかし名前はあなたが希望するものであればなんでもかまいません。
2. `fragment_stage` は技術的には Optional (あってもなくてもよい)なので `Some()` でラップしてます。私は頂点シェーダーをフラグメントシェーダーなしで使ったことはありませんが、もし必要なら使わないという選択もできます。

```rust
    // continued ...
    rasterization_state: Some(wgpu::RasterizationStateDescriptor {
        front_face: wgpu::FrontFace::Ccw,
        cull_mode: wgpu::CullMode::Back,
        depth_bias: 0,
        depth_bias_slope_scale: 0.0,
        depth_bias_clamp: 0.0,
    }),
```

<!--
`rasterization_state` describes how to process primitives (in our case triangles) before they are sent to the fragment shader (or the next stage in the pipeline if there is none). Primitives that don't meet the criteria are *culled* (aka not rendered). Culling helps speed up the rendering process by not rendering things that should not be visible anyway.
-->
`rasterization_state` はフラグメントシェーダー(やそれがない場合には次のステージのパイプラインに)にデータを送る前にどのようにプリミティブを処理するかを記述します。(ここでは三角形をどう扱うか)プリミティブは基準に合わなければ取り除かれます。(つまり描画されません)。カリングは見えてはいけないものを描画しないので、レンダリングプロセスをスピードアップさせる助けになります。

<!--
We'll cover culling a bit more when we cover `Buffer`s.
-->
カリングについては `Buffer` の項でさらに触れます。

```rust
    // continued ...
    color_states: &[
        wgpu::ColorStateDescriptor {
            format: sc_desc.format,
            color_blend: wgpu::BlendDescriptor::REPLACE,
            alpha_blend: wgpu::BlendDescriptor::REPLACE,
            write_mask: wgpu::ColorWrite::ALL,
        },
    ],
```
<!--
A `color_state` describes how colors are stored and processed throughout the pipeline. You can have multiple color states, but we only need one as we're just drawing to the screen. We use the `swap_chain`'s format so that copying to it is easy, and we specify that the blending should just replace old pixel data with new data. We also tell `wgpu` to write to all colors: red, blue, green, and alpha. *We'll talk more about*`color_state` *when we talk about textures.*
-->
`color_state` はパイプライン中でどのように色が保存されたり処理されるかを記述します。複数の color state を用意することができますが、スクリーンに描画するには一つだけあればよいでしょう。`swap_chain` のフォーマットをコピーするのが簡単ですし、色のブレンディングは古いピクセルデータを新しいものでリプレースするだけでよいでしょう。また GPU には 青、赤、黄色、透明度のすべての値を書き込むようにしています。テクスチャについては話すときに　`color_state` についてもう少し触れます。

```rust
    // continued ...
    primitive_topology: wgpu::PrimitiveTopology::TriangleList, // 1.
    depth_stencil_state: None, // 2.
    vertex_state: wgpu::VertexStateDescriptor {
        index_format: wgpu::IndexFormat::Uint16, // 3.
        vertex_buffers: &[], // 4.
    },
    sample_count: 1, // 5.
    sample_mask: !0, // 6.
    alpha_to_coverage_enabled: false, // 7.
});
```

<!--
The rest of the method is pretty simple:
1. We tell `wgpu` that we want to use a list of triangles for drawing.
2. We're not using a depth/stencil buffer currently, so we leave `depth_stencil_state` as `None`. *This will change later*.
3. We specify the type of index we want to use. In this case a 16-bit unsigned integer. We'll talk about indices when we talk about `Buffer`s.
4. `vertex_buffers` is a pretty big topic, and as you might have guessed, we'll talk about it when we talk about buffers.
5. This determines how many samples this pipeline will use. Multisampling is a complex topic, so we won't get into it here.
6. `sample_mask` specifies which samples should be active. In this case we are using all of them.
7. `alpha_to_coverage_enabled` has to do with anti-aliasing. We're not covering anti-aliasing here, so we'll leave this as false now.
-->
残りのメソッドはシンプルです。
1. `wgpu` に描画のために三角形を使うと教えます
2. 今はデプス・ステンシルバッファを使いませんので、`depth_stencil_state` には `None` を指定します。ここは後で変えます。
3. インデックスに使う型を指定します。ここでは16bit符号なし整数です。 `Buffer` で触れます。
4. `vertex_buffers` はあなたも想像したでしょうがとても大きなトピックで、 `Buffer` で触れます。
5. ここではパイプラインでいくつのサンプルを扱うか決めます。マルチサンプリングは複雑なトピックでここでは扱いません。
6. `sample_mask` はサンプルがアクティブかどうか明記します。ここではすべてアクティブとしています。
7. `alpha_to_coverage_enabled` はアンチエイリアシングです。私たちはアンチエイリアシングをここではカバーしないので今は false を指定します。

<!-- https://gamedev.stackexchange.com/questions/22507/what-is-the-alphatocoverage-blend-state-useful-for -->

<!--
Now all we have to do is save the `render_pipeline` to `State` and then we can use it!
-->
これで `render_pipeline` を　`State` に追加できたので使えます！

```rust
// new()
Self {
    surface,
    device,
    queue,
    sc_desc,
    swap_chain,
    // NEW!
    render_pipeline,
    size,
}
```
<!--
## Using a pipeline
-->
## パイプラインを使う

<!--
If you run your program now, it'll take a little longer to start, but it will still show the blue screen we got in the last section. That's because while we created the `render_pipeline`, we need to modify the code in `render()` to actually use it.
-->
もしプログラムを今走らせると、起動には少し時間がかかるでしょうが、まだ前のセクションで実装した青いスクリーンが表示されるでしょう。これは　`render_pipeline` を作りましたが、実際に使うには `render()` に修正が必要なためです。

```rust
// render()

// ...
{
    // 1.
    let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
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

    // NEW!
    render_pass.set_pipeline(&self.render_pipeline); // 2.
    render_pass.draw(0..3, 0..1); // 3.
}
// ...
```

<!--
We didn't change much, but let's talk about what we did change.
1. We renamed `_render_pass` to `render_pass` and made it mutable.
2. We set the pipeline on the `render_pass` using the one we just created.
3. We tell `wgpu` to draw *something* with 3 vertices, and 1 instance. This is where `gl_VertexIndex` comes from.
-->
大きな変更はありませんが、変更点についてみていきましょう。
1. `_render_pass` が　`render_pass` に変更され mutable になりました
2. `render_pass` に先ほど作った pipeline がセットしました
3. `wgpu` に3つの座標があり1つのインスタンスがあると伝えています。これがgl_VertexIndexの出所です。

<!--
With all that you should be seeing a lovely brown triangle.
-->
すべてやり終えると愛らしい茶色の三角形が出てきます。

![Said lovely brown triangle](./tutorial3-pipeline-triangle.png)

## Challenge
<!--
Create a second pipeline that uses the triangle's position data to create a color that it then sends to the fragment shader to use for `f_color`. Have the app swap between these when you press the spacebar. *Hint: use*`in`*and*`out`*variables in a separate shader.*
-->
もう一つパイプラインを作ってみましょう。トライアングルの位置から色を作りフラグメントシェーダーが使う f_color に指定してみましょう。そしてスペースキーを押すとパイプラインが切り替わるようにしてみましょう。ヒント:このシェーダーで `in` 変数と `out` 変数を使います。

<AutoGithubLink/>
