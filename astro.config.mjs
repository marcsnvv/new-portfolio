import tailwind from "@astrojs/tailwind";
import compress from "astro-compress";
import icon from "astro-icon";
import { defineConfig } from 'astro/config';
import vercel from "@astrojs/vercel/serverless";

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), icon(), compress()],
  output: "server",
  adapter: vercel(),
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      langs: ['javascript', 'typescript', 'python', 'go', 'bash', 'json', 'markdown'],
      wrap: true
    },
    remarkPlugins: [],
    rehypePlugins: []
  }
});