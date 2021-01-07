module.exports = {
    base: '/learn-wgpu/',
    title: 'Learn Wgpu',
    theme: 'thindark',
    plugins: {
        'vuepress-plugin-code-copy': true,
        '@vuepress/back-to-top': true,
        'seo': {
        },
    },
    themeConfig: {
        author: {
            name: 'Benjamin R Hansen',
            twitter: 'https://twitter.com/sotrh760',
        },
        displayAllHeaders: false,
        lastUpdated: 'Last Updated',
        sidebar: [
            '/',
            {
                title: 'Beginner',
                collapsable: false,
                children: [
                    '/beginner/tutorial1-window/',
                    '/beginner/tutorial2-swapchain/',
                    '/beginner/tutorial3-pipeline/',
                    '/beginner/tutorial4-buffer/',
                    '/beginner/tutorial5-textures/',
                    '/beginner/tutorial6-uniforms/',
                    '/beginner/tutorial7-instancing/',
                    '/beginner/tutorial8-depth/',
                    '/beginner/tutorial9-models/',
                ],
            },
            {
                title: 'Intermediate',
                collapsable: false,
                children: [
                    '/intermediate/tutorial10-lighting/',
                    '/intermediate/tutorial11-normals/',
                    '/intermediate/tutorial12-camera/',
                    '/intermediate/tutorial13-threading/',
                ],
            },
            {
                title: 'Showcase',
                collapsable: true,
                children: [
                    '/showcase/',
                    '/showcase/windowless/',
                    '/showcase/gifs/',
                    '/showcase/pong/',
                    '/showcase/compute/',
                    '/showcase/alignment/',
                    '/showcase/imgui-demo/',
                ]
            },
            '/news/'
        ]
    }
}