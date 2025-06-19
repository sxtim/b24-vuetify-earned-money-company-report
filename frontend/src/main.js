import { createApp } from "vue"
import App from "./App.vue"
import { initBX24 } from "./utils/bx24"

// Vuetify
import "@mdi/font/css/materialdesignicons.css" // Import MDI icons
import { createVuetify } from "vuetify"
import { ru } from "vuetify/locale"
import "vuetify/styles"

const vuetify = createVuetify({
	locale: {
		locale: "ru",
		messages: { ru },
	},
}) // The vite-plugin-vuetify will handle components and directives

// Initialize the Bitrix24 API and then mount the app
initBX24()
	.then(bx24 => {
		const app = createApp(App)
		app.provide("BX24", bx24) // Provide the BX24 object to all components
		app.use(vuetify).mount("#app")
	})
	.catch(err => {
		// Gracefully handle initialization errors, e.g., show a message to the user
		console.error("Failed to initialize Bitrix24 Application:", err)
		// You could display an error message in the UI here
		document.getElementById("app").innerHTML =
			'<div style="text-align: center; padding: 20px;">' +
			"<h3>Ошибка инициализации приложения</h3>" +
			"<p>Не удалось подключиться к Битрикс24. Пожалуйста, попробуйте перезагрузить страницу.</p>" +
			"</div>"
	})
