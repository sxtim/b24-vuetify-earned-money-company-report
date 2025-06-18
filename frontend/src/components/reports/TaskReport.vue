<template>
	<div>
		<v-data-table-server
			v-model:items-per-page="itemsPerPage"
			:headers="headers"
			:items="taskData"
			:items-length="totalItems"
			:loading="isLoading"
			:search="searchTrigger"
			@update:options="loadItems"
			class="elevation-1"
			item-value="id"
			:items-per-page-options="itemsPerPageOptions"
			:style="tableStyle"
		>
			<template v-slot:loading>
				<v-skeleton-loader type="table-row@5"></v-skeleton-loader>
			</template>
		</v-data-table-server>

		<!-- Summary Information -->
		<v-card-text class="pa-2 mt-4">
			<v-row justify="end" class="font-weight-bold">
				<v-col cols="auto">Общий итог:</v-col>
				<v-col cols="2">Запланировано: {{ totalPlanned }} ч</v-col>
				<v-col cols="2">Затрачено: {{ totalActual }} ч</v-col>
				<v-col cols="2">Всего задач: {{ totalItems }}</v-col>
			</v-row>
		</v-card-text>
	</div>
</template>

<script setup>
import { computed, inject, ref, watch } from "vue"

const props = defineProps({
	taskFilters: {
		type: Object,
		default: () => ({}),
	},
	userMap: {
		type: Object,
		default: () => ({}),
	},
	loading: {
		type: Boolean,
		default: false,
	},
})

// BX24 API
const BX24 = inject("BX24")

// Table state
const itemsPerPage = ref(10)
const itemsPerPageOptions = [
	{ value: 10, title: "10" },
	{ value: 25, title: "25" },
	{ value: 50, title: "50" },
]
const totalItems = ref(0)
const searchTrigger = ref(0)
const cache = ref({})
const taskData = ref([])
const isLoading = ref(false)

// Headers for the table
const headers = [
	{ title: "Задача", key: "task", sortable: false },
	{ title: "Сотрудник", key: "employee", sortable: false },
	{ title: "План (ч)", key: "planned", sortable: false },
	{ title: "Факт (ч)", key: "actual", sortable: false },
	{ title: "Дней на выполнение", key: "days", sortable: false },
]

// Helper function to format hours
const formatHours = seconds => {
	if (!seconds) return 0
	return Math.round(seconds / 3600)
}

// Helper function to calculate days between dates
const getDaysBetween = (startDate, endDate) => {
	if (!startDate || !endDate) return "N/A"
	const start = new Date(startDate)
	const end = new Date(endDate)
	const diffTime = Math.abs(end - start)
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
	return diffDays
}

// Calculate table style based on rows
const tableStyle = computed(() => {
	// Approximate heights for Vuetify components to calculate min-height
	const headerHeight = 56 // v-table header
	const rowHeight = 52 // v-table row with default density
	const footerHeight = 59 // v-data-table-footer
	const minHeight = headerHeight + itemsPerPage.value * rowHeight + footerHeight
	return { minHeight: `${minHeight}px` }
})

// Total planned hours
const totalPlanned = computed(() => {
	const totalSeconds = taskData.value.reduce(
		(sum, task) =>
			sum + (task.plannedSeconds ? parseInt(task.plannedSeconds) : 0),
		0
	)
	return formatHours(totalSeconds)
})

// Total actual hours
const totalActual = computed(() => {
	const totalSeconds = taskData.value.reduce(
		(sum, task) =>
			sum + (task.actualSeconds ? parseInt(task.actualSeconds) : 0),
		0
	)
	return formatHours(totalSeconds)
})

// Promisify BX24.callMethod
const callB24Method = (method, params) => {
	return new Promise((resolve, reject) => {
		if (!BX24) {
			return reject("BX24 object is not available.")
		}
		BX24.callMethod(method, params, res => {
			const b24Error = res.error ? res.error() : null
			if (b24Error) {
				console.error("B24 Error:", b24Error)
				reject(new Error(b24Error.error_description || "Bitrix24 API error"))
			} else {
				resolve(res)
			}
		})
	})
}

// Load items for the current page
const loadItems = async ({ page, itemsPerPage, sortBy }) => {
	isLoading.value = true

	const startOffset = (page - 1) * itemsPerPage
	const b24PageStart = Math.floor(startOffset / 50) * 50

	try {
		// Fetch from Bitrix24 API only if the page is not in cache
		if (!cache.value[b24PageStart]) {
			const res = await callB24Method("tasks.task.list", {
				select: [
					"ID",
					"TITLE",
					"RESPONSIBLE_ID",
					"CREATED_DATE",
					"CLOSED_DATE",
					"TIME_ESTIMATE",
					"TIME_SPENT_IN_LOGS",
				],
				filter: props.taskFilters,
				start: b24PageStart,
			})

			cache.value[b24PageStart] = res.data().tasks || []
			if (page === 1) {
				totalItems.value = res.total() || 0
			}
		}

		const cachedPage = cache.value[b24PageStart] || []
		const sliceStart = startOffset % 50
		const sliceEnd = sliceStart + itemsPerPage

		const pageTasks = cachedPage.slice(sliceStart, sliceEnd)

		// Преобразуем данные для отображения
		taskData.value = pageTasks.map(task => ({
			id: `task-${task.id}`,
			task: task.title,
			employee: props.userMap[task.responsibleId] || "Не назначен",
			planned: formatHours(task.timeEstimate),
			actual: formatHours(task.timeSpentInLogs),
			days: getDaysBetween(task.createdDate, task.closedDate),
			plannedSeconds: task.timeEstimate || 0,
			actualSeconds: task.timeSpentInLogs || 0,
		}))
	} catch (e) {
		console.error("Failed to load task items:", e)
		taskData.value = []
	} finally {
		isLoading.value = false
	}
}

// Reset cache and trigger reload when filters change
watch(
	() => props.taskFilters,
	() => {
		cache.value = {}
		searchTrigger.value += 1
	},
	{ deep: true }
)
</script>
