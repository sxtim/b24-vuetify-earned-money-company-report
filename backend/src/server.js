const express = require("express")
const axios = require("axios")
const path = require("path")

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

// Serve static files from the root of the dist directory in production
if (process.env.NODE_ENV === "production") {
	// The server is running from /dist/src, so we go up one level to find the root
	const staticFilesPath = path.join(__dirname, "..")
	app.use(express.static(staticFilesPath))

	// For all other GET requests, serve the frontend's index.html
	app.get("*", (req, res) => {
		res.sendFile(path.join(staticFilesPath, "index.html"))
	})
}

/**
 * A proxy endpoint to make calls to the Bitrix24 REST API.
 * The frontend will send the necessary auth details with each request.
 */
app.post("/api/call", async (req, res) => {
	const { method, params, auth } = req.body

	if (!method || !auth || !auth.domain || !auth.access_token) {
		return res
			.status(400)
			.json({ error: "Method, domain, and access_token are required." })
	}

	const apiUrl = `https://${auth.domain}/rest/${method}`

	try {
		const response = await axios.post(apiUrl, {
			...params,
			auth: auth.access_token,
		})

		// Handle potential Bitrix24 API errors if they are in the response body
		if (response.data.error) {
			console.error("Bitrix24 API Error:", response.data.error_description)
			return res.status(502).json({ error: response.data.error_description })
		}

		// TODO: Handle pagination for methods that return lists (see our note)
		// Check for `response.data.next` and `response.data.total`

		res.json(response.data)
	} catch (error) {
		console.error(
			"API call failed:",
			error.response ? error.response.data : error.message
		)
		res.status(500).json({ error: "Failed to call Bitrix24 API." })
	}
})

app.listen(PORT, () => {
	console.log(`Backend server is running on http://localhost:${PORT}`)
})
