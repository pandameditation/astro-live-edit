## Astro-Live-Edit

This is a starter repository that shows how to configure any Astro project to provide a live-editing experience for Astro and Markdown files. It currently supports .astro, .md and .mdx files.


The project contains an Astro project (the demo and specific configuration to make it work) and a node server that will serve as the backend for the live-editing experience.

When running `npm run dev:edit` it will start astro dev server (like if `npm run dev`) and also the editing server. You will see that all editable content can now be live-edited (with contenteditable attribute on them). 

When you save, it will use the injected markup to find where the content is located in the source, replace the old content with the edited content, in a clean way. 

## Features

- **Live Editing**: Edit content directly in the browser and see changes in real-time.
- **Source Tracking**: The system tracks the source file and line number for each editable element. This is largely given for free by Astro.
- **Clean Saving**: When you save, the system replaces the old content with the edited content in a clean way.
- **Multiple File Support**: Supports .astro, .md, and .mdx files out of the box.