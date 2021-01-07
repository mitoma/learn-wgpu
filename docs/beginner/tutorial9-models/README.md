# Model Loading

<!--
Up to this point we've been creating our models manually. While this is an acceptable way to do this, but it's really slow if we want to include complex models with lots of polygons. Because of this, we're going modify our code to leverage the obj model format so that we can create a model in a software such as blender and display it in our code.
-->
ここまでは、モデルを手動で作成していました。今まではそれでよかったですが、これはもし複雑なモデルをたくさんのポリゴンで作ろうとするには非常に遅いです。そういうわけなので、ソフトウェアをオブジェクトのフォーマットをブレンダーのようなソフトで作ったモデルのようにし、私たちのコードで表示するように修正します。

<!--
Our `main.rs` file is getting pretty cluttered, let's create a `model.rs` file that we can put our model loading code into.
-->
`main.rs` ファイルは非常に雑然としているので `model.rs` ファイルを作りモデルをロードするためのコードを入れましょう。

```rust
// model.rs
pub trait Vertex {
    fn desc<'a>() -> wgpu::VertexBufferDescriptor<'a>;
}

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct ModelVertex {
    position: [f32; 3],
    tex_coords: [f32; 2],
    normal: [f32; 3],
}

impl Vertex for ModelVertex {
    fn desc<'a>() -> wgpu::VertexBufferDescriptor<'a> {
        todo!();
    }
}
```

<!--
You'll notice a couple of things here. In `main.rs` we had `Vertex` as a struct, here we're using a trait. We could have multiple vertex types (model, UI, instance data, etc.). Making `Vertex` a trait will allow us to abstract our the `VertexBufferDescriptor` creation code to make creating `RenderPipeline`s simpler.
-->
このコードを見て二つのことに気づくでしょう。`main.rs` では `Vertex` は構造体でしたがここでは trait を使っています。これにより複数の vertex type (model, UI, インスタンスデータ, など)を扱うことができます。`Vertex` trait は `VertexBufferDescriptor` を作れるようにすることで `RenderPipeline` をシンプルにしましょう。

<!--
Another thing to mention is the `normal` field in `ModelVertex`. We won't use this until we talk about lighting, but will add it to the struct for now.
-->
別の点として `normal` field を `ModelVertex` に追加しました。これはライティングの項目に行くまで使いませんが、ここで追加しておきます。

<!--
Let's define our `VertexBufferDescriptor`.
-->
`VertexBufferDescriptor` を定義していきましょう。

```rust
impl Vertex for ModelVertex {
    fn desc<'a>() -> wgpu::VertexBufferDescriptor<'a> {
        wgpu::VertexBufferDescriptor {
            stride: std::mem::size_of::<ModelVertex>() as wgpu::BufferAddress,
            step_mode: wgpu::InputStepMode::Vertex,
            attributes: &wgpu::vertex_attr_array![
                0 => Float3,
                1 => Float2,
                2 => Float3
            ],
        }
    }
}
```

<!--
This is basically the same as the original `VertexBufferDescriptor`, but we added a `VertexAttributeDescriptor` for the `normal`. Remove the `Vertex` struct in `main.rs` as we won't need it anymore, and use our new `Vertex` from model for the `RenderPipeline`.
-->
これは基本的にはオリジナルの `VertexBufferDescriptor` と同じですが、`normal` のための `VertexAttributeDescriptor` を追加しています。不要になった `Vertex` 構造体を `main.rs` から削除して、新しい `Vertex` を `RenderPipeline` に使います。

```rust
let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
    // ...
    vertex_state: wgpu::VertexStateDescriptor {
        index_format: wgpu::IndexFormat::Uint16,
        vertex_buffers: &[model::ModelVertex::desc()],
    },
    // ...
});
```

<!--
With all that in place we need a model to render. If you have one already that's great, but I've supplied a [zip file](https://github.com/sotrh/learn-wgpu/blob/master/code/beginner/tutorial9-models/res/cube.zip) with the model and all of it's textures. We're going to put this model in a new `res` folder next to the existing `src` folder.
-->
すべてが整うと、レンダリングのためにモデルが必要になります。もしすでに持っていれば素晴らしいことですが、なければ [zip file](https://github.com/sotrh/learn-wgpu/blob/master/code/beginner/tutorial9-models/res/cube.zip) でモデルとテクスチャを用意してあります。`res` フォルダにモデルを置きましょう。

## Accessing files in the res folder

<!--
When cargo builds and runs our program it sets what's known as the current working directory. This directory is usually the folder containing your projects root `Cargo.toml`. The path to our res folder may differ depending on the structure of the project. In the `res` folder for the example code for this section tutorial is at `code/beginner/tutorial9-models/res/`. When loading our model we could use this path, and just append `cube.obj`. This is fine, but if we change our projects structure, our code will break.
-->
cargo でプログラムをビルドしたり実行するとき、現在の作業ディレクトリがセットされます。このディレクトリはたいていプロジェクトルートの `Cargo.toml` のあるフォルダです。リソースフォルダのパスは、もしかするとプロジェクトの構成に依存して異なる場所にあるかもしれません。このセクションのチュートリアル例では `res` フォルダは `code/beginner/tutorial9-models/res/` です。モデルをロードするとき、このパスに `cube.obj` を追加して使います。これは分かりやすいですがプロジェクトの構成を変えたとき、コードが壊れてしまいます。

<!--
We're going to fix that by modifying our build script to copy our `res` folder to where cargo creates our executable, and we'll reference it from there. Add the following lines to `build.rs` after you compile the shaders.
-->
これを修正するためにビルドスクリプトで `res` フォルダを実行ファイルのある場所にコピーし、それを参照することにします。`build.rs` でシェーダーをコンパイルした後に以下を記述します。

```rust
// This tells cargo to rerun this script if something in /res/ changes.
println!("cargo:rerun-if-changed=res/*");

let out_dir = env::var("OUT_DIR")?;
let mut copy_options = CopyOptions::new();
copy_options.overwrite = true;
let mut paths_to_copy = Vec::new();
paths_to_copy.push("res/");
copy_items(&paths_to_copy, out_dir, &copy_options)?;
```

<div class="note">

<!--
The `OUT_DIR` is an environment variable that cargo uses to specify where our application will be built.
-->
OUT_DIR は cargo がビルド時に使う環境変数です。

</div>


## Loading models with TOBJ

<!--
We're going to use the [tobj](https://docs.rs/tobj/0.1.12/tobj/) library to load our model. Before we can load our model though, we need somewhere to put it.
-->
ここではモデルを読み込むために [tobj](https://docs.rs/tobj/0.1.12/tobj/) ライブラリを使います。私たちのモデルを読み込む前に、いくつかコードに追加が必要です。

```rust
// model.rs
pub struct Model {
    pub meshes: Vec<Mesh>,
    pub materials: Vec<Material>,
}
```

<!--
You'll notice that our `Model` struct has a `Vec` for the `meshes`, and for `materials`. This is important as our obj file can include multiple meshes and materials. We still need to create the `Mesh` and `Material` classes, so let's do that.
-->
`Model` 構造体に `Vec` の `meshes` と `materials` があることに気づくでしょう。これはオブジェクトファイルに複数の meshes と materials が含まれているため非常に重要です。`Mesh` と `Material` クラスも以下のように作る必要があります。

```rust
pub struct Material {
    pub name: String,
    pub diffuse_texture: texture::Texture,
}

pub struct Mesh {
    pub name: String,
    pub vertex_buffer: wgpu::Buffer,
    pub index_buffer: wgpu::Buffer,
    pub num_elements: u32,
    pub material: usize,
}
```

<!--
The `Material` is pretty simple, it's just the name and one texture. Our cube obj actually has 2 textures, but one is a normal map, and we'll get to those [later](../../intermediate/normal-mapping). The name is more for debugging purposes.
-->
`Material` はとてもシンプルで、名前とテクスチャだけです。私たちの Cube obj は実際に 2 つのテクスチャしかありませんが、一つは normal マップで、それは[後々](../../intermediate/normal-mapping)使います。name は多くの場合デバッグ目的のものです。

<!--
Speaking of textures, we'll need to add a `load()` method to `Texture` in `texture.rs`.
-->
テクスチャーといえば、 `texture.rs` にある `Texture` に `load()` メソッドを足す必要があります。

```rust
use std::path::Path;

pub fn load<P: AsRef<Path>>(
    device: &wgpu::Device,
    queue: &wgpu::Queue,
    path: P,
) -> Result<(Self, wgpu::CommandBuffer), failure::Error> {
    // Needed to appease the borrow checker
    let path_copy = path.as_ref().to_path_buf();
    let label = path_copy.to_str();
    
    let img = image::open(path)?;
    Self::from_image(device, queue, &img, label)
}
```

<!--
The `load` method will be useful when we load the textures for our models, as `include_bytes!` requires that we know the name of the file at compile time which we can't really guarantee with model textures.
-->
`load` メソッドは私たちのモデルのテクスチャを読み込むときにとても役に立ちます。`include_bytes!` はコンパイル時にファイル名が必要になりますが、私たちはモデルのテクスチャが常にあることを保証はできません。

<!--
While we're at it let's import `texture.rs` in `model.rs`.
-->
では `texture.rs` を `model.rs` から読み込みましょう。

```rust
use crate::texture;
```

<!--
We also need to make a subtle change on `from_image()` method in `texture.rs`. PNGs work fine with `as_rgba8()`, as they have an alpha channel. But, JPEGs don't have an alpha channel, and the code would panic if we try to call `as_rgba8()` on the JPEG texture image we are going to use. Instead, we can use `to_rgba()` to handle such an image.
-->
`texture.rs` の `from_image()` もまた変更が必要です。PNGファイルは `as_rgba8()` でアルファチャネルも問題なく動きます。しかし、JPEGファイルはアルファチャネルは持たないのでこのコードで JPEG テクスチャ画像を読み込もうとすると `as_rgba8()` でパニックが発生します。代わりにそれらの画像では `to_rgba()` を使います。

```rust
let rgba = img.to_rgba(); 
```

<!--
`Mesh` holds a vertex buffer, an index buffer, and the number of indices in the mesh. We're using an `usize` for the material. This `usize` will be used to index the `materials` list when it comes time to draw.
-->
`Mesh` は頂点バッファ、インデックスバッファ、メッシュ内のインデックスの数を持ちます。material には `usize` を使います。この `usize` は `matelials` のリストのインデックスとして描画時に使われます。

<!--
With all that out of the way, we can get to loading our model.
-->
これでモデルのロードに取り掛かることができます。

```rust
impl Model {
    pub fn load<P: AsRef<Path>>(
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        layout: &wgpu::BindGroupLayout,
        path: P,
    ) -> Result<Self> {
        let (obj_models, obj_materials) = tobj::load_obj(path.as_ref(), true)?;

        // We're assuming that the texture files are stored with the obj file
        // texture file は obj file と一緒に保存されていると仮定している。
        let containing_folder = path.as_ref().parent()
            .context("Directory has no parent")?;

        let mut materials = Vec::new();
        for mat in obj_materials {
            let diffuse_path = mat.diffuse_texture;
            let diffuse_texture = texture::Texture::load(device, queue, containing_folder.join(diffuse_path))?;

            let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
                layout,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: wgpu::BindingResource::TextureView(&diffuse_texture.view),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::Sampler(&diffuse_texture.sampler),
                    },
                ],
                label: None,
            });

            materials.push(Material {
                name: mat.name,
                diffuse_texture,
                bind_group,
            });
        }

        let mut meshes = Vec::new();
        for m in obj_models {
            let mut vertices = Vec::new();
            for i in 0..m.mesh.positions.len() / 3 {
                vertices.push(ModelVertex {
                    position: [
                        m.mesh.positions[i * 3],
                        m.mesh.positions[i * 3 + 1],
                        m.mesh.positions[i * 3 + 2],
                    ],
                    tex_coords: [m.mesh.texcoords[i * 2], m.mesh.texcoords[i * 2 + 1]],
                    normal: [
                        m.mesh.normals[i * 3],
                        m.mesh.normals[i * 3 + 1],
                        m.mesh.normals[i * 3 + 2],
                    ],
                });
            }

            let vertex_buffer = device.create_buffer_init(
                &wgpu::util::BufferInitDescriptor {
                    label: Some(&format!("{:?} Vertex Buffer", path.as_ref())),
                    contents: bytemuck::cast_slice(&vertices),
                    usage: wgpu::BufferUsage::VERTEX,
                }
            );
            let index_buffer = device.create_buffer_init(
                &wgpu::util::BufferInitDescriptor {
                    label: Some(&format!("{:?} Index Buffer", path.as_ref())),
                    contents: bytemuck::cast_slice(&m.mesh.indices),
                    usage: wgpu::BufferUsage::INDEX,
                }
            );

            meshes.push(Mesh {
                name: m.name,
                vertex_buffer,
                index_buffer,
                num_elements: m.mesh.indices.len() as u32,
                material: m.mesh.material_id.unwrap_or(0),
            });
        }

        Ok(Self { meshes, materials })
    }
}
```

<!--
Make sure that you change the `IndexFormat` that the `RenderPipeline` uses from `Uint16` to `Uint32`. Tobj stores the indices as `u32`s, so using a lower bit stride will result in your model getting mangled.
-->
`RenderPipeline` が `Uint16` から `Uint32` に `IndexFormat` を変更します。Tobj はインデックスを u32 で保存しているので少ないビット数で扱うとモデルがめちゃくちゃになってしまうからです。

```rust
let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
    // ...
    vertex_state: wgpu::VertexStateDescriptor {
        index_format: wgpu::IndexFormat::Uint32,
        vertex_buffers: &[model::ModelVertex::desc()],
    },    // ...
});
```

## Rendering a mesh

<!--
Before we can draw the model, we need to be able to draw an individual mesh. Let's create a trait called `DrawModel`, and implement it for `RenderPass`.
-->
モデルを描画する前に、独立したメッシュを描画できるようにする必要があります。`DrawModel` と呼ばれる trait を作成し、`RenderPass` に実装しましょう。

```rust
pub trait DrawModel<'a, 'b>
where
    'b: 'a,
{
    fn draw_mesh(&mut self, mesh: &'b Mesh);
    fn draw_mesh_instanced(
        &mut self,
        mesh: &'b Mesh,
        instances: Range<u32>,
    );
}
impl<'a, 'b> DrawModel<'a, 'b> for wgpu::RenderPass<'a>
where
    'b: 'a,
{
    fn draw_mesh(&mut self, mesh: &'b Mesh) {
        self.draw_mesh_instanced(mesh, 0..1);
    }

    fn draw_mesh_instanced(
        &mut self,
        mesh: &'b Mesh,
        instances: Range<u32>,
    ){
        self.set_vertex_buffer(0, mesh.vertex_buffer.slice(..));
        self.set_index_buffer(mesh.index_buffer.slice(..));
        self.draw_indexed(0..mesh.num_elements, 0, instances);
    }
}
```

<!--
We could have put this methods in `impl Model`, but I felt it made more sense to have the `RenderPass` do all the rendering, as that's kind of it's job. This does mean we have to import `DrawModel` when we go to render though.
-->
このメソッドを `impl Model` に実装することもできますが、`RenderPass` にすべてレンダリングさせるほうが理にかなっていると感じました。これは render するときに `DrawModel` を import する必要があることを意味しています。

```rust
// main.rs
render_pass.set_pipeline(&self.render_pipeline);
render_pass.set_bind_group(0, &self.diffuse_bind_group, &[]);
render_pass.set_bind_group(1, &self.uniform_bind_group, &[]);

use model::DrawModel;
render_pass.draw_mesh_instanced(&self.obj_model.meshes[0], 0..self.instances.len() as u32);
```

<!--
Before that though we need to actually load the model and save it to `State`. Put the following in `State::new()`.
-->
それを行う前に、実際にモデルをロードして `State` に保存しなければいけません。`State::new()` に以下を追加しましょう。

```rust
let res_dir = std::path::Path::new(env!("OUT_DIR")).join("res");
let obj_model = model::Model::load(
    &device,
    &queue,
    &texture_bind_group_layout,
    res_dir.join("cube.obj"),
).unwrap();
```

<div class="note">

<!--
We're using `OUT_DIR` here to get at our `res` folder.
-->
`OUT_DIR` という環境変数を利用して `res` フォルダを解決しています。

</div>

<!--
Our new model is a bit bigger than our previous one so we're gonna need to adjust the spacing on our instances a bit.
-->
新しいモデルは私たちの前のものよりもわずかに大きいので、幅を合わせが必要になります。

```rust
const SPACE_BETWEEN: f32 = 3.0;
let instances = (0..NUM_INSTANCES_PER_ROW).flat_map(|z| {
    (0..NUM_INSTANCES_PER_ROW).map(move |x| {
        let x = SPACE_BETWEEN * (x as f32 - NUM_INSTANCES_PER_ROW as f32 / 2.0);
        let z = SPACE_BETWEEN * (z as f32 - NUM_INSTANCES_PER_ROW as f32 / 2.0);

        let position = cgmath::Vector3 { x, y: 0.0, z };

        let rotation = if position.is_zero() {
            cgmath::Quaternion::from_axis_angle(cgmath::Vector3::unit_z(), cgmath::Deg(0.0))
        } else {
            cgmath::Quaternion::from_axis_angle(position.clone().normalize(), cgmath::Deg(45.0))
        };

        Instance {
            position, rotation,
        }
    })
}).collect::<Vec<_>>();
```

<!--
With all that done, you should get something like this.
-->
すべて終わると以下のようになるでしょう。

![cubes.png](./cubes.png)

<!--
## Using the correct textures
-->
## 正しい Texture を使う

<!--
If you look at the texture files for our obj, you'll see that they don't match up to our obj. The texture we want to see is this one,
-->
もし obj の texture file を見たら、 obj とあっていないように感じるでしょう。私たちは以下のようなテクスチャを使いたいはずです。

![cube-diffuse.jpg](./cube-diffuse.jpg)

<!--
but we're still getting our happy tree texture.
-->
しかし、まだハッピーな木のテクスチャを使っています。

<!--
The reason for this is quite simple. Though we've created our textures we haven't created a bind group to give to the `RenderPass`. We're still using our old `diffuse_bind_group`. If we want to change that we need to create a bind group for our materials. Add a `bind_group` field to `Material`.
-->
この理由は簡単です。私たちは `RenderPass` の bind group に texture を作っていないからです。私たちはまだ古い `diffuse_bind_group` を使っています。もし、これを変えたければ bind group を material を使うようにしなければいけません。`Material` に `bind_group` フィールドを追加しましょう。

```rust
pub struct Material {
    pub name: String,
    pub diffuse_texture: texture::Texture,
    pub bind_group: wgpu::BindGroup, // NEW!
}
```

<!--
We're going to add a material parameter to `DrawModel`.
-->
`DrawModel` に matelial parameter を追加しましょう。

```rust
pub trait DrawModel<'a, 'b>
where
    'b: 'a,
{
    fn draw_mesh(&mut self, mesh: &'b Mesh, material: &'b Material, uniforms: &'b wgpu::BindGroup);
    fn draw_mesh_instanced(
        &mut self,
        mesh: &'b Mesh,
        material: &'b Material,
        instances: Range<u32>,
        uniforms: &'b wgpu::BindGroup,
    );

}

impl<'a, 'b> DrawModel<'a, 'b> for wgpu::RenderPass<'a>
where
    'b: 'a,
{
    fn draw_mesh(&mut self, mesh: &'b Mesh, material: &'b Material, uniforms: &'b wgpu::BindGroup) {
        self.draw_mesh_instanced(mesh, material, 0..1, uniforms);
    }

    fn draw_mesh_instanced(
        &mut self,
        mesh: &'b Mesh,
        material: &'b Material,
        instances: Range<u32>,
        uniforms: &'b wgpu::BindGroup,
    ) {
        self.set_vertex_buffer(0, mesh.vertex_buffer.slice(..));
        self.set_index_buffer(mesh.index_buffer.slice(..));
        self.set_bind_group(0, &material.bind_group, &[]);
        self.set_bind_group(1, &uniforms, &[]);
        self.draw_indexed(0..mesh.num_elements, 0, instances);
    }
}
```

<!--
We need to change the render code to reflect this.
-->
render するコードにもこれを反映します。

```rust
render_pass.set_pipeline(&self.render_pipeline);

let mesh = &self.obj_model.meshes[0];
let material = &self.obj_model.materials[mesh.material];
render_pass.draw_mesh_instanced(mesh, material, 0..self.instances.len() as u32, &self.uniform_bind_group);
```

<!--
With all that in place we should get the following.
-->
すべてを行うと以下のようになります。

![cubes-correct.png](./cubes-correct.png)

## Rendering the entire model

<!--
Right now we are specifying the mesh and the material directly. This is useful if we want to draw a mesh with a different material. We're also not rendering other parts of the model (if we had some). Let's create a method for `DrawModel` that will draw all the parts of the model with their respective materials.
-->
今は mesh と material を直接指定しています。別の素材でメッシュを描きたい場合に便利です。別パーツのモデルを描画するということもまだやっていません(もしそれらがあったとしても)。モデルのすべてのパーツをそれぞれのマテリアルで描画するような `DrawModel` のメソッドを作成してみましょう。

```rust
pub trait DrawModel<'a, 'b>
where
    'b: 'a,
{
    // ...
    fn draw_model(&mut self, model: &'b Model, uniforms: &'b wgpu::BindGroup);
    fn draw_model_instanced(
        &mut self,
        model: &'b Model,
        instances: Range<u32>,
        uniforms: &'b wgpu::BindGroup,
    );
}

impl<'a, 'b> DrawModel<'a, 'b> for wgpu::RenderPass<'a>
where
    'b: 'a, {
    // ...
    fn draw_model(&mut self, model: &'b Model, uniforms: &'b wgpu::BindGroup) {
        self.draw_model_instanced(model, 0..1, uniforms);
    }

    fn draw_model_instanced(
        &mut self,
        model: &'b Model,
        instances: Range<u32>,
        uniforms: &'b wgpu::BindGroup,
    ) {
        for mesh in &model.meshes {
            let material = &model.materials[mesh.material];
            self.draw_mesh_instanced(mesh, material, instances.clone(), uniforms);
        }
    }
}
```

<!--
The code in `main.rs` will change accordingly.
-->
`main.rs` のコードを適切に変更します。

```rust
render_pass.set_pipeline(&self.render_pipeline);
render_pass.draw_model_instanced(&self.obj_model, 0..self.instances.len() as u32, &self.uniform_bind_group);
```

<AutoGithubLink/>
