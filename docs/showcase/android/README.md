# Running on Android

The mobile market is a big one. If your game is simple enough, it's almost a no brainer to launch on mobile. I'm a Android dev by trade, so I felt I needed to add an example of running Wgpu on Android.

Now normally we would make an Android app via Android Studio. While we do need to install Android Studio, we aren't going to code in it at all. We're going to code everything in Rust. We can use this using a couple crates called [cargo-apk](https://docs.rs/cargo-apk/), and [ndk-glue](https://docs.rs/ndk-glue/).

## cargo-apk

The `cargo-apk` crate handles all the Android boiler plate for us. This isn't a normal dependency though. It's a cargo extension, so we need to install it to cargo itself.

```bash
cargo install cargo-apk
```

With that done, we need to set up the NDK. We'll need to open Android Studio's SDK Manager for this. Open any Android Studio project, and click the SDK Manager button in the top right of the editor. It's the cube with a down arrow.

![](./sdk-manager-button.png)

Now check the `NDK (Side by side)` option and click `OK`. That will install the NDK if you haven't done that already.

We're going to need some environment variables for `cargo-apk` to know how to use the Android SDK and NDK to build your application. I won't go into the specifics of how to create environment variables as it will vary between operating systems. On my system (Linux) I added these lines to `~/.bashrc`.

```bash
# Android Env Variables
export ANDROID_SDK_ROOT="/path/to/Android/Sdk"
export ANDROID_NDK_ROOT="/path/to/Android/Sdk/ndk/21.2.6472646"
export ANDROID_HOME=$ANDROID_SDK_ROOT
export ANDROID_NDK_HOME=$ANDROID_NDK_ROOT
```

Usually Android Studio installs these in your `home` directory (at least on Linux).

Now that `cargo-ndk` has all that it needs. Let's get onto the code and `ndk-glue`.

## ndk-glue

Let's use the code from the [pipeline tutorial](/docs/beginner/tutorial3-pipeline/). We're going to need to make some slight modifications to make it work. First we need to include the `ndk-glue` crate.

```toml
[dependencies]
image = "0.23.4"
winit = "0.22.2"
shaderc = "0.6"
cgmath = "0.17"
wgpu = "0.5.0"
futures = "0.3.5"

[target.'cfg(target_os = "android")'.dependencies]
ndk-glue = "0.1.0"
```

I've also updated the other dependencies to there latest (as of writing) versions.

The next change is a bit bigger. The `cargo-apk` addon includes your code by building it into a library, and packaging that with the resulting APK. We'll need to change `main.rs` into `lib.rs`. Then we'll add the following to our `Cargo.toml`.

```toml
[lib]
crate-type = ["lib", "cdylib"]
```

The `"cdylib"` is what Android will use. The `"lib"` is so we can still run the application on a PC.
