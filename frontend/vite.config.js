import vue from "@vitejs/plugin-vue"
import fs from "fs"
import path from "path"
import { defineConfig } from "vite"
import vuetify from "vite-plugin-vuetify"

/**
 * A custom Vite plugin to handle Bitrix24's initial POST request.
 * Bitrix24 can load the app via a POST request to the root URL with auth params.
 * This plugin intercepts such requests and serves the main index.html.
 */
const bitrixPostRequestPlugin = () => ({
	name: "handle-bitrix-post-request",
	configureServer(server) {
		server.middlewares.use(async (req, res, next) => {
			// Check if it's a POST request to the root, which is how Bitrix24 loads the app.
			if (req.method === "POST" && req.originalUrl.startsWith("/?")) {
				try {
					const indexPath = path.resolve(server.config.root, "index.html")
					let html = fs.readFileSync(indexPath, "utf-8")
					// Let Vite transform the HTML to inject its scripts and styles
					html = await server.transformIndexHtml(req.originalUrl, html)
					res.statusCode = 200
					res.setHeader("Content-Type", "text/html")
					res.end(html)
					return // Stop the chain
				} catch (e) {
					console.error(e)
					return next(e)
				}
			}
			// For all other requests, continue to the next middleware
			next()
		})
	},
})

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
	return {
		// Set the base path to be relative for production builds, absolute for development
		base: command === "build" ? "./" : "/",
		// Explicitly set the app type to 'spa' to ensure fallback to index.html
		// This is crucial for the Bitrix24 dev environment.
		appType: "spa",
		plugins: [vue(), vuetify({ autoImport: true }), bitrixPostRequestPlugin()],
		server: {
			host: "0.0.0.0", // Allow access from outside the container
			port: 5173,
			https: {
				key: fs.readFileSync("../ssl/localhost.key"),
				cert: fs.readFileSync("../ssl/localhost.crt"),
			},
			proxy: {
				"/api": {
					target: "http://localhost:3000",
					changeOrigin: true,
				},
			},
			// Enable polling for file changes to fix HMR in Docker on some systems.
			watch: {
				usePolling: true,
			},
		},
	}
})
