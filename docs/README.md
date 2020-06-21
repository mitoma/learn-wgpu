# Introduction

このサイトは [https://sotrh.github.io/learn-wgpu/](https://sotrh.github.io/learn-wgpu/) の非公式かつ個人的な和訳です。ゴールは Beginner までの和訳。

明白な誤りやご連絡は [https://github.com/mitoma/learn-wgpu](https://github.com/mitoma/learn-wgpu) までどうぞ。

<!--
## What is wgpu?
-->
## wgpu とは何ですか？
<!--
[Wgpu](https://github.com/gfx-rs/wgpu) is a Rust implementation of the [WebGPU API spec](https://gpuweb.github.io/gpuweb/). WebGPU is a specification published by the GPU for the Web Community Group. It aims to allow web code access to GPU functions in a safe and reliable manner. It does this by mimicking the Vulkan API, and translating that down to whatever API the host hardware is using (ie. DirectX, Metal, Vulkan).
-->
[wgpu](https://github.com/gfx-rs/wgpu) は [WebGPU API spec](https://gpuweb.github.io/gpuweb/) の Rust 実装です。WebGPU は GPU のための Web Community Group によって策定されています。これは GPU の機能を安全かつマナーを守って Web のコードからアクセスできるようにすることを狙いとしています。WebGPU は Valkan API を似せて実装されておりホストマシンの使っているハードウェア(DirectX, Metal, Valkan)に向けて翻訳されます。

<!--
Wgpu is still in development, so some of this doc is subject to change.
-->
wgpu はまだ開発中なので、いくつかのドキュメントは変更される可能性があります。

<!--
## Why Rust?
-->
## なぜ Rust でしょう
<!--
Wgpu actually has C bindings to allow you to write C/C++ code with it, as well as use other languages that interface with C. That being said, wgpu is written in Rust, and it has some convient Rust Bindings that don't have to jump through any hoops. On top of that, I've been enjoying writing in Rust.
-->
Wgpu は実際に C バインディングを持っており C/C++でコードを書くこともできますし、C を呼び出せる言語でそれを使うことも同様にできます。とはいえ wgpu は Rust で書かれているので、Rust Binding を使うと飛び越えなくてはいけない障害が少なくなります。そのうえ Rust で書くのは楽しいです。

<!--
You should be fairly familiar with Rust before using this tutorial as I won't go into much detail on Rust syntax. If you're not super comfortable with Rust you can review the [Rust tutorial](https://www.rust-lang.org/learn). You should also be familiar about [Cargo](https://doc.rust-lang.org/cargo/).
-->
このチュートリアルでは Rust の構文の詳細に触れないので、事前に Rust の構文についてはよく知っている必要があります。もし万全でなければ [Rust tutorial](https://www.rust-lang.org/learn) をやりましょう。また Cargo にも精通しておいてください。

<!--
I'm using this project as a way to learn wgpu myself, so I might miss some important details, or explain things wrong. I'm always open to constructive feedback. That being said, let's get started!
-->
私はこのプロジェクトを私自身が wgpu を学ぶために行っています。なので重要な詳細を省いてしまっていたりもしかしたら間違っているかもしれません。建設的な feedback には前向きです。それではやっていきましょう！
