<template>
	<div>
		<v-data-table
			v-model:items-per-page="itemsPerPage"
			:headers="headers"
			:items="employeeData"
			:loading="isLoading"
			class="elevation-1"
			item-value="id"
			:items-per-page-options="itemsPerPageOptions"
		>
			<template v-slot:loading>
				<v-skeleton-loader type="table-row@5"></v-skeleton-loader>
			</template>
		</v-data-table>

		<!-- Summary Information -->
		<v-card-text class="pa-2 mt-4">
			<v-row justify="end" class="font-weight-bold">
				<v-col cols="auto">Общий итог:</v-col>
				<v-col cols="2">Запланировано: {{ totalPlanned }} ч</v-col>
				<v-col cols="2">Затрачено: {{ totalActual }} ч</v-col>
				<v-col cols="2">Всего задач: {{ totalTasks }}</v-col>
			</v-row>
		</v-card-text>
	</div>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from "vue"

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
const isLoading = ref(false)

// Data
const allTasks = ref([])
const employeeData = ref([])
const totalTasks = ref(0)

// Headers for the table
const headers = [
	{ title: "Сотрудник", key: "employee", sortable: false },
	{ title: "Задачи", key: "taskCount", sortable: false },
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

// Total planned hours
const totalPlanned = computed(() => {
	const totalSeconds = allTasks.value.reduce(
		(sum, task) => sum + (task.timeEstimate ? parseInt(task.timeEstimate) : 0),
		0
	)
	return formatHours(totalSeconds)
})

// Total actual hours
const totalActual = computed(() => {
	const totalSeconds = allTasks.value.reduce(
		(sum, task) =>
			sum + (task.timeSpentInLogs ? parseInt(task.timeSpentInLogs) : 0),
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

// Load all tasks and process them
const loadAllTasks = async () => {
	isLoading.value = true
	allTasks.value = []

	try {
		// Загружаем все задачи без пагинации
		let tasks = []
		let startIndex = 0
		let hasMoreData = true

		while (hasMoreData) {
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
				start: startIndex,
			})

			const tasksData = res.data().tasks || []
			tasks = [...tasks, ...tasksData]

			// Проверяем, есть ли еще данные для загрузки
			startIndex += tasksData.length
			hasMoreData = tasksData.length > 0 && startIndex < res.total()

			// Если данных слишком много, устанавливаем лимит
			if (tasks.length > 1000) {
				console.warn("Слишком много задач, ограничение в 1000.")
				hasMoreData = false
			}
		}

		// Сохраняем все задачи и общее количество
		allTasks.value = tasks
		totalTasks.value = tasks.length

		// Обрабатываем данные для отображения по сотрудникам
		processEmployeeData()
	} catch (e) {
		console.error("Failed to load employee tasks:", e)
		allTasks.value = []
		employeeData.value = []
	} finally {
		isLoading.value = false
	}
}

// Process tasks and group by employee
const processEmployeeData = () => {
	// Группировка по сотруднику
	const byEmployee = allTasks.value.reduce((acc, task) => {
		const employeeId = task.responsibleId

		// Пропускаем задачи без назначенного сотрудника
		if (!employeeId) {
			return acc
		}

		if (!acc[employeeId]) {
			acc[employeeId] = {
				id: `emp-${employeeId}`,
				employee: props.userMap[employeeId] || "Не назначен",
				taskCount: 0,
				planned: 0,
				actual: 0,
				totalDays: 0,
				tasksWithDays: 0,
			}
		}

		acc[employeeId].taskCount++
		acc[employeeId].planned += task.timeEstimate
			? parseInt(task.timeEstimate)
			: 0
		acc[employeeId].actual += task.timeSpentInLogs
			? parseInt(task.timeSpentInLogs)
			: 0

		// Добавляем расчет дней на выполнение
		const days = getDaysBetween(task.createdDate, task.closedDate)
		if (days !== "N/A") {
			acc[employeeId].totalDays += parseInt(days)
			acc[employeeId].tasksWithDays++
		}

		return acc
	}, {})

	// Форматируем данные
	employeeData.value = Object.values(byEmployee).map(emp => ({
		...emp,
		planned: formatHours(emp.planned),
		actual: formatHours(emp.actual),
		days:
			emp.tasksWithDays > 0
				? Math.round(emp.totalDays / emp.tasksWithDays) + " (в среднем)"
				: "N/A",
	}))
}

// Reload data when filters change
watch(
	() => props.taskFilters,
	() => {
		loadAllTasks()
	},
	{ deep: true }
)

// Load data on component mount
onMounted(() => {
	loadAllTasks()
})
</script>
