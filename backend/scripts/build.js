const { execSync } = require("child_process")
const fs = require("fs-extra")
const path = require("path")

console.log("Starting production build process...")

// Define absolute paths
const rootDir = path.resolve(__dirname, "..", "..")
const frontendDir = path.join(rootDir, "frontend")
const backendDir = path.join(rootDir, "backend")
const distDir = path.join(rootDir, "dist")

try {
	// 1. Clean the dist directory
	console.log("Cleaning dist directory...")
	fs.emptyDirSync(distDir)

	// 2. Build the frontend
	console.log("Building frontend application...")
	execSync("npm run build", { cwd: frontendDir, stdio: "inherit", shell: true })
	const frontendBuildDir = path.join(frontendDir, "dist")

	// 3. Copy frontend build to the root of dist
	console.log(`Copying frontend build to ${distDir}...`)
	fs.copySync(frontendBuildDir, distDir)

	// 4. Copy backend source files to dist/src
	console.log("Copying backend source files...")
	fs.copySync(path.join(backendDir, "src"), path.join(distDir, "src"))

	// 5. Create a production-ready package.json in dist
	console.log("Creating production package.json...")
	const backendPackageJson = fs.readJsonSync(
		path.join(backendDir, "package.json")
	)
	const prodPackageJson = {
		name: "b24-app-production",
		version: "1.0.0",
		main: "src/server.js",
		scripts: {
			start: "NODE_ENV=production node src/server.js",
		},
		dependencies: backendPackageJson.dependencies,
	}
	fs.writeJsonSync(path.join(distDir, "package.json"), prodPackageJson, {
		spaces: 2,
	})

	// 6. Create README for deployment
	const readmeContent = `# Production Build

This directory contains the production-ready application.
The server will serve the frontend files from the root of this directory.

## To run on a server:
1. Upload the contents of this 'dist' directory to your server.
2. Run \`npm install --production\` in this directory.
3. Run \`npm start\` to launch the server.
`
	fs.writeFileSync(path.join(distDir, "README.md"), readmeContent.trim())

	console.log("\nBuild process completed successfully!")
	console.log(`Production build is ready in: ${distDir}`)
} catch (error) {
	console.error("\nBuild process failed:")
	console.error(error)
	process.exit(1)
}
