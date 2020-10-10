# Dependencies and the window

<!--
## Boring, I know
-->
## ご存じの通り退屈です
<!--
Some of you reading this are very experienced with opening up windows in Rust and probably have your favorite windowing library, but this guide is designed for everybody, so it's something that we need to cover. Luckily, you don't need to read this if you know what you're doing. One thing that you do need to know is that whatever windowing solution you use needs to support the [raw-window-handle](https://github.com/rust-windowing/raw-window-handle) crate.
-->
何人かの人はすでに window を Rust で作ったことがあり好きな window ライブラリがあるでしょう。このガイドは万人に向けてデザインされていますので、そういうことも書かれています。幸運にもすでにご存じの方はここは読む必要がありません。知っておくべこことは、window ライブラリが [raw-window-handle](https://github.com/rust-windowing/raw-window-handle) crate をサポートする必要があることです。

<!--
## What crates are we using?
-->
## どの crate を使うか
<!--
For the beginner stuff, we're going to keep things very simple, we'll add things as we go, but I've listed the relevant `Cargo.toml` bits below.
-->
ビギナーにはシンプルな方がよいでしょう。チュートリアルが進むにつれていくつか追加しますがここに `Cargo.toml` に書くものをリストアップします。

```toml
[dependencies]
image = "0.23"
winit = "0.22"
shaderc = "0.6"
cgmath = "0.17"
env_logger = "0.7"
log = "0.4"
wgpu = "0.6"
futures = "0.3"
```

### Vulkan Portability Layer

<!--
You may also want to make the Vulkan backend available on platforms where it is by default not, e.g. Mac OS. The reason
you might want to enable the Vulkan backend is if you are doing cross-platform development and you need the
Vulkan validation layers output. 
-->
もしかすると Vulkan backend がデフォルトで有効でない環境(例えば Mac OS などで) Vulkan backend を利用したいかもしれません。その理由は cross-platform 開発で Vulkan validation layers の出力が必要で Vulkan backend を有効にしたいからということもあります。

<!--
To enable the Vulkan backend, add this new section to `Cargo.toml`, and do not forget to remove `wgpu` from the earlier
`[dependencies]` section.
-->
Vulkan backend を有効にするには、 `Cargo.toml` に新しいセクションを追加し、忘れずに `wgpu` を最初の `[dependencies]` セクションから削除してください。

``` toml
[dependencies.wgpu]
version = "0.6"
features = ["vulkan-portability"]
```

<!--
- This may not be necessary because normally `wgpu-rs` validation will catch problems. In fact that is one of it's
  design goals.
- This is not intended for shipping code. 
- See also [gfx-portability](https://github.com/gfx-rs/portability).
-->
- これはもしかしたら不要かもしれません。というのも通常 `wgpu-rs` の validation は問題を補足します。実際、それは `wgpu-rs` の設計のゴールの一つです。
- この example はリリースすることが意図されたコードではありません。
- [gfx-portability](https://github.com/gfx-rs/portability) も参照しておいてください。

## The code
<!--
There's not much going on here yet, so I'm just going to post the code in full. Just paste this into you're `main.rs` or equivalent.
-->
まだ何もやっていないので、コード全体を書きます。`main.rs` などにこの内容をペーストしてください。

```rust
use winit::{
    event::*,
    event_loop::{EventLoop, ControlFlow},
    window::{Window, WindowBuilder},
};

fn main() {
    env_logger::init();
    let event_loop = EventLoop::new();
    let window = WindowBuilder::new()
        .build(&event_loop)
        .unwrap();

    event_loop.run(move |event, _, control_flow| {
        match event {
            Event::WindowEvent {
                ref event,
                window_id,
            } if window_id == window.id() => match event {
                WindowEvent::CloseRequested => *control_flow = ControlFlow::Exit,
                WindowEvent::KeyboardInput {
                    input,
                    ..
                } => {
                    match input {
                        KeyboardInput {
                            state: ElementState::Pressed,
                            virtual_keycode: Some(VirtualKeyCode::Escape),
                            ..
                        } => *control_flow = ControlFlow::Exit,
                        _ => {}
                    }
                }
                _ => {}
            }
            _ => {}
        }
    });
}
```

<!--
All this does is create a window, and keep it open until until user closes it, or presses escape. Next tutorial we'll actually start using wgpu!
-->
これで window を作成でき、ユーザーが windowののクローズ操作をしたり escape キーを押すまで window を開き続けます。次のチュートリアルから真に wgpu を使ったチュートリアルが始まります！

<AutoGithubLink/>
