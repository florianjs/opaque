import { defineConfig } from "vitepress";

export default defineConfig({
  title: "opaque",
  description: "Self-hosted secrets vault for AI-agent workflows",
  base: "/opaque/",
  ignoreDeadLinks: true,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/introduction" },
      { text: "CLI", link: "/cli/commands" },
      { text: "SDK", link: "/sdk/overview" },
      { text: "API", link: "/api/reference" },
      { text: "Security", link: "/security/model" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Introduction", link: "/guide/introduction" },
            { text: "Quick Start", link: "/guide/quick-start" },
            { text: "Vault Setup", link: "/guide/vault-setup" },
            { text: "Key Rotation", link: "/guide/key-rotation" },
          ],
        },
      ],
      "/cli/": [
        {
          text: "CLI",
          items: [{ text: "Commands", link: "/cli/commands" }],
        },
      ],
      "/sdk/": [
        {
          text: "SDK",
          items: [
            { text: "Overview", link: "/sdk/overview" },
            { text: "Node.js", link: "/sdk/node" },
            { text: "Next.js", link: "/sdk/nextjs" },
            { text: "Nuxt", link: "/sdk/nuxt" },
            { text: "Core SDK", link: "/sdk/core" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API",
          items: [{ text: "Reference", link: "/api/reference" }],
        },
      ],
      "/security/": [
        {
          text: "Security",
          items: [{ text: "Security Model", link: "/security/model" }],
        },
      ],
    },
    socialLinks: [{ icon: "github", link: "https://github.com/your-org/opaque" }],
    footer: {
      message: "MIT License",
      copyright: "opaque — self-hosted secrets vault",
    },
    search: { provider: "local" },
  },
});
