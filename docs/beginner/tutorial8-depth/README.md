# The Depth Buffer

<!--
Let's take a closer look at the last example.
-->
最後のサンプルをよく見てみてください。

![forest_with_zoom.png](./forest_with_zoom.png)

<!--
Models that should be in the back are getting rendered ahead of ones that should be in the front. This is caused by the draw order. By default, pixel data from a new object will replace old pixel data.
-->
後ろ側にあるべきモデルが前面のモデルよりも前にレンダリングされています。この原因は描画の順序です。デフォルトでは新しいオブジェクトのピクセルデータは古いピクセルデータを置き換えます。

<!--
There are two ways to solve this: sort the data from back to front, use what's known as a depth buffer.
-->
この解決には2つの方法があります。データを後ろから前にソートするか、depth buffer と呼ばれるものを使うかです。

<!--
## Sorting from back to front
-->
## 後ろから前にソートする

<!--
This is the go to method for 2d rendering as it's pretty easier to know what's supposed to go in front of what. You can just use the z order. In 3d rendering it gets a little more tricky because the order of the objects changes based on the camera angle.
-->
これは二次元をレンダリングする場合には、どちらが前面かわかるのでとても容易です。単に z 軸の順序でよいからです。三次元をレンダリングする場合、少しトリッキーになります。なぜならオブジェクトの順序はカメラのアングルに基づいて変わるからです。

<!--
A simple way of doing this is to sort all the objects by their distance to the cameras position. There are flaws with this method though as when a large object is behind a small object, parts of the large object that should be in front of the small object will be rendered behind. We'll also run into issues with objects that that overlap *themselves*.
-->
すべてのオブジェクトをカメラの位置からの距離でソートするのは簡単な方法です。この方法は大きなオブジェクトが小さなオブジェクトの背後にある時に、大きなオブジェクトの一部が小さなオブジェクトの前面に来ているとき、小さなオブジェクトはその背後に描かれなければいけないのに、描かれないという欠陥があります。オブジェクトが重なっている場合にもこの問題が発生します。

<!--
If want to do this properly we need to have pixel level precision. That's where a *depth buffer* comes in.
-->
もしこの問題を適切に扱いたい場合、ピクセルレベルの精度が必要です。そこで `depth buffer` の出番です。

## A pixels depth

<!--
A depth buffer is a black and white texture that stores the z-coordinate of rendered pixels. Wgpu can use this when drawing new pixels to determine whether to replace the data or keep it. This technique is called depth testing. This will fix our draw order problem without needing us to sort our objects!
-->
depth buffer は黒と白のテクスチャでレンダリングされたピクセルのz座標を保存します。wgpu はこれを使って新しいピクセルで置き換えるかそのままにしておくかを決定します。このテクニックは depth testing と呼ばれます。これで描画順序の問題をオブジェクトのソートなしに解決することができます。

<!--
Let's make a function to create the depth texture in `texture.rs`.
-->
`texture.rs` の中に depth texture を作る関数を書きましょう。

```rust
impl Texture {
    pub const DEPTH_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Depth32Float; // 1.
    
    pub fn create_depth_texture(device: &wgpu::Device, sc_desc: &wgpu::SwapChainDescriptor, label: &str) -> Self {
        let size = wgpu::Extent3d { // 2.
            width: sc_desc.width,
            height: sc_desc.height,
            depth: 1,
        };
        let desc = wgpu::TextureDescriptor {
            label: Some(label),
            size,
            array_layer_count: 1,
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: Self::DEPTH_FORMAT,
            usage: wgpu::TextureUsage::OUTPUT_ATTACHMENT // 3.
                | wgpu::TextureUsage::SAMPLED,
        };
        let texture = device.create_texture(&desc);

        let texture = device.create_texture(&desc);
        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        let sampler = device.create_sampler(
            &wgpu::SamplerDescriptor { // 4.
                address_mode_u: wgpu::AddressMode::ClampToEdge,
                address_mode_v: wgpu::AddressMode::ClampToEdge,
                address_mode_w: wgpu::AddressMode::ClampToEdge,
                mag_filter: wgpu::FilterMode::Linear,
                min_filter: wgpu::FilterMode::Linear,
                mipmap_filter: wgpu::FilterMode::Nearest,
                compare: Some(wgpu::CompareFunction::LessEqual), // 5.
                lod_min_clamp: -100.0,
                lod_max_clamp: 100.0,
                ..Default::default()
            }
        );

        Self { texture, view, sampler }
    }
}
```

<!--
1. We need the DEPTH_FORMAT for when we create the depth stage of the `render_pipeline` and creating the depth texture itself.
2. Our depth texture needs to be the same size as our screen if we want things to render correctly. We can use our `sc_desc` to make sure that our depth texture is the same size as our swap chain images.
3. Since we are rendering to this texture, we need to add the `OUTPUT_ATTACHMENT` flag to it.
4. We technically don't *need* a sampler for a depth texture, but our `Texture` struct requires it, and we need one if we ever want to sample it.
5. If we do decide to render our depth texture, we need to use `CompareFunction::LessEqual`. This is due to how the `samplerShadow` and `sampler2DShadow()` interacts with the `texture()` function in GLSL.
-->
1. DEPTH_FORMAT は `render_pipeline` の depth stage を作る時や depth texture 自身を作る時に必要になります。
2. depth texture はレンダリングを正確に行うためにはスクリーンと同じサイズが必要になります。`sc_desc` を使って swap chain のイメージと同じサイズの物を作ります。
3. この texture をレンダリングするにあたって `OUTPUT_ATTACHEMENT` flag をつける必要があります。
4. 技術的には depth texture にとって sampler は**必要ではありません**。しかし `Texture` 構造体はそれを必要としているため、レンダリングしたければそれが必要になります。
5. もし depth texture を render しようとすGSLS 場合には、 `CompareFunction::LessEqual` を使います。これは `samplerShadow` や `sampler2DShadow` が GSLS の `texture()` 関数でどのように動くかを決めます。

<!--
We create our `depth_texture` in `State::new()`.
-->
`State::new()` の `depth_texture` を作りましょう

```rust
let depth_texture = texture::Texture::create_depth_texture(&device, &sc_desc, "depth_texture");
```

<!--
We need to modify our `render_pipeline` to allow depth testing. 
-->
`render_pipeline` で depth testing を行うように変更します。

```rust
let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
    // ...
    depth_stencil_state: Some(wgpu::DepthStencilStateDescriptor {
        format: texture::Texture::DEPTH_FORMAT,
        depth_write_enabled: true,
        depth_compare: wgpu::CompareFunction::Less, // 1.
        stencil: wgpu::StencilStateDescriptor::default(), // 2.
    }),
    // ...
});
```

<!--
1. The `depth_compare` function tells us when to discard a new pixel. Using `LESS` means pixels will be drawn front to back. Here are all the values you can use.
-->
`depth_compare` 関数で新しいピクセルかどうかを決める関数を教えます。 `LESS` を使うとピクセルは前から後ろに描画できます。これが使える値のすべてです。

```rust
#[repr(C)]
#[derive(Copy, Clone, Debug, Hash, Eq, PartialEq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum CompareFunction {
    Undefined = 0,
    Never = 1,
    Less = 2,
    Equal = 3,
    LessEqual = 4,
    Greater = 5,
    NotEqual = 6,
    GreaterEqual = 7,
    Always = 8,
}
```

<!--
2. There's another type of buffer called a stencil buffer. It's common practice to store the stencil buffer and depth buffer in the same texture. This fields control values for stencil testing. Since we aren't using a stencil buffer, we'll use default values. We'll cover stencil buffers [later](../../todo).
-->
2. これは別のタイプの buffer で stencil buffer と呼ばれます。stencil buffer と depth buffer を同じ texture に格納するのは一般的な方法です。このフィールドは stancil testing を行うかどうかを制御します。現段階では stencil buffer は使いませんので、デフォルト値を使いましょう。stencil buffer については[後々](../../todo)触れます。

<!--
Don't forget to store the `depth_texture` in `State`.
-->
`State` に `depth_texture` を保存するのを忘れないようにしましょう。

```rust
Self {
    // ...
    depth_texture,
}
```

<!--
We need to remember to change the `resize()` method to create a new `depth_texture` and `depth_texture_view`.
-->
`resize()` メソッドが呼ばれたときに `depth_texture` と `depth_texture_view` を修正しないといけないことを思い出す必要があります。

```rust
fn resize(&mut self, new_size: winit::dpi::PhysicalSize<u32>) {
    // ...

    self.depth_texture = texture::Texture::create_depth_texture(&self.device, &self.sc_desc, "depth_texture");

    // ...
}
```

<!--
Make sure you update the `depth_texture` *after* you update `sc_desc`. If you don't, your program will crash as the `depth_texture` will be a different size than the `swap_chain` texture.
-->
`sc_desc` を更新した後に `depth_texture` を確実に更新する必要があります。もし行わなければプログラムは `depth_texture` が `swap_chain` texture と別のサイズになってしまったことによってクラッシュするでしょう。

<!--
The last change we need to make is in the `render()` function. We've created the `depth_texture`, but we're not currently using it. We use it by attaching it to the `depth_stencil_attachment` of a render pass.
-->
最後に `render()` 関数を変更する必要があります。`depth_texture` を作りましたがまだ使っていません。`depth_stencil_attachement` を render pass にくっつけます。

```rust
let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
    /// ...
    depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachmentDescriptor {
        attachment: &self.depth_texture.view,
        depth_ops: Some(wgpu::Operations {
            load: wgpu::LoadOp::Clear(1.0),
            store: true,
        }),
        stencil_ops: None,
    }),
});
```

<!--
And that's all we have to do! No shader code needed! If you run the application, the depth issues will be fixed.
-->
これですべてです。shader のコードは不要です。もしアプリケーションを実行すれば depth の問題は修正されているでしょう。

![forest_fixed.png](./forest_fixed.png)

## Challenge

<!--
Since the depth buffer is a texture, we can sample it in the shader. Because it's a depth texture, we'll have to use the `samplerShadow` uniform type and the `sampler2DShadow` function instead of `sampler`, and `sampler2D` respectively. Create a bind group for the depth texture (or reuse an existing one), and render it to the screen.
-->
depth buffer は texture なので shader の中でサンプリングすることができます。depth texture を `sampler` や `sampler2D` の代わりにそれぞれ `samplerShadow` という uniform type や `sampler2DShadow` 関数で使うことができます。depth texture のための bind group を作るか存在するやつを再利用してそれを screen に描画してみましょう。

<AutoGithubLink/>
