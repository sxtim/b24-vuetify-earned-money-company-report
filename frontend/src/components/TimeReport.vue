<template>
	<v-card>
		<v-card-title class="pb-4 d-flex align-center">
			Отчет по затраченному времени сотрудника
			<v-icon class="ml-2" size="small" @click="faqDialog = true">
				mdi-information-outline
			</v-icon>
		</v-card-title>
		<v-card-text>
			<!-- Filters -->
			<v-row align="center">
				<v-col cols="12" sm="6" md="3">
					<v-autocomplete
						label="Сотрудник"
						:items="allUsers"
						v-model="selectedEmployees"
						item-title="name"
						item-value="ID"
						multiple
						clearable
						chips
						closable-chips
					>
						<template v-slot:item="{ props, item }">
							<v-list-item v-bind="props" :title="item.raw.name">
								<template v-slot:prepend>
									<v-checkbox-btn
										:model-value="selectedEmployees.includes(item.raw.ID)"
									></v-checkbox-btn>
								</template>
							</v-list-item>
						</template>
					</v-autocomplete>
				</v-col>
				<v-col cols="12" sm="6" md="3">
					<v-select
						label="Статус задачи"
						:items="taskStatuses"
						v-model="selectedStatuses"
						item-title="title"
						item-value="value"
						multiple
						clearable
						chips
						closable-chips
					></v-select>
				</v-col>
				<v-col cols="12" sm="12" md="4" style="max-width: 360px">
					<v-menu
						v-model="dateMenu"
						:close-on-content-click="false"
						transition="scale-transition"
						min-width="auto"
						max-width="360px"
						@update:model-value="onDateMenuToggle"
					>
						<template v-slot:activator="{ props }">
							<v-text-field
								v-bind="props"
								:model-value="formattedDateRange"
								label="Период завершения задачи"
								prepend-icon="mdi-calendar"
								readonly
								clearable
								@click:clear="dateRange = []"
								style="width: 360px; max-width: 360px"
								class="date-picker-field"
							></v-text-field>
						</template>
						<v-card
							style="width: 100%; max-width: 360px; box-sizing: border-box"
						>
							<v-card-text>
								<v-date-picker
									v-model="tempDateRange"
									multiple="range"
									color="primary"
									show-adjacent-months
									:first-day-of-week="1"
									hide-header
									locale="ru"
									:day-format="date => new Date(date).getDate()"
									style="width: 100%; max-width: 360px; box-sizing: border-box"
								></v-date-picker>
							</v-card-text>
							<v-card-actions>
								<v-spacer></v-spacer>
								<v-btn variant="text" @click="dateMenu = false"> Отмена </v-btn>
								<v-btn color="primary" variant="text" @click="applyDateRange">
									Применить
								</v-btn>
							</v-card-actions>
						</v-card>
					</v-menu>
				</v-col>
				<v-col cols="12" sm="12" md="auto" class="d-flex justify-end">
					<v-btn-toggle v-model="reportMode" mandatory density="compact">
						<v-btn value="byTask">По задачам</v-btn>
						<v-btn value="byEmployee">По сотрудникам</v-btn>
					</v-btn-toggle>
				</v-col>
			</v-row>

			<!-- Отчет по задачам -->
			<div v-if="reportMode === 'byTask'">
				<TaskReport
					:taskFilters="taskFilters"
					:userMap="userMap"
					:loading="loading"
				/>
			</div>

			<!-- Отчет по сотрудникам -->
			<div v-else>
				<EmployeeReport
					:taskFilters="taskFilters"
					:userMap="userMap"
					:loading="loading"
				/>
			</div>
		</v-card-text>

		<v-alert v-if="error" type="error" dense>
			{{ error }}
		</v-alert>

		<v-dialog v-model="faqDialog" max-width="600px">
			<v-card>
				<v-card-title>
					<span class="text-h5">Справка по работе с отчетом</span>
				</v-card-title>
				<v-card-text>
					<p>
						Это приложение предназначено для формирования отчетов по
						затраченному времени на основе данных из вашего Битрикс24.
					</p>
					<br />
					<p><strong>Режимы отчета:</strong></p>
					<ul>
						<li>
							<strong>По задачам:</strong> Детальный отчет, где каждая строка -
							это отдельная задача. Отображаются плановые и фактические
							трудозатраты по каждой задаче.
						</li>
						<li>
							<strong>По сотрудникам:</strong> Сводный отчет, группирующий все
							задачи по исполнителям. Показывает общее количество задач,
							суммарное плановое и фактическое время для каждого сотрудника.
						</li>
					</ul>
					<br />
					<p><strong>Фильтры:</strong></p>
					<ul>
						<li>
							<strong>Сотрудник:</strong> Выберите одного или нескольких
							сотрудников для фильтрации отчета.
						</li>
						<li>
							<strong>Статус задачи:</strong> Фильтрация по текущему статусу
							задач (Новая, Выполняется, Завершена и т.д.).
						</li>
						<li>
							<strong>Период завершения задачи:</strong> Укажите диапазон дат, в
							который задачи были завершены.
						</li>
					</ul>
					<br />
					<p>
						Отчет обновляется автоматически при изменении любого из фильтров.
					</p>
				</v-card-text>
				<v-card-actions>
					<v-spacer></v-spacer>
					<v-btn color="primary" text @click="faqDialog = false">Закрыть</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</v-card>
</template>

<script setup>
import { computed, inject, onMounted, ref } from "vue"
import EmployeeReport from "./reports/EmployeeReport.vue"
import TaskReport from "./reports/TaskReport.vue"

// --- Helper Functions ---
const formatDate = dateString => {
	const date = new Date(dateString)
	return date.toLocaleDateString("ru-RU", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	})
}

// --- State ---
const loading = ref(false)
const error = ref(null)
const BX24 = inject("BX24")

// Filters and Mode
const reportMode = ref("byTask") // 'byTask' or 'byEmployee'
const selectedEmployees = ref([])
const selectedStatuses = ref([])
const dateRange = ref([])
const tempDateRange = ref([])
const dateMenu = ref(false)
const faqDialog = ref(false)

const onDateMenuToggle = isOpen => {
	if (isOpen) {
		// Clone the array to avoid reactivity issues
		tempDateRange.value = [...dateRange.value]
	}
}

const applyDateRange = () => {
	dateRange.value = [...tempDateRange.value]
	dateMenu.value = false
}

// Форматирование диапазона дат для отображения
const formattedDateRange = computed(() => {
	if (!dateRange.value || dateRange.value.length === 0) {
		return ""
	}

	if (dateRange.value.length === 1) {
		return formatDate(dateRange.value[0])
	}
	return `${formatDate(dateRange.value[0])} — ${formatDate(
		dateRange.value[dateRange.value.length - 1]
	)}`
})

// Data
const allUsers = ref([]) // For employee filter
const taskStatuses = ref([
	{ title: "Новая", value: "2" },
	{ title: "Выполняется", value: "3" },
	{ title: "Ждет выполнения", value: "4" },
	{ title: "Завершена", value: "5" },
	{ title: "Отложена", value: "6" },
])

// Общие фильтры для передачи в дочерние компоненты
const taskFilters = computed(() => {
	const filters = {}

	if (selectedEmployees.value.length > 0) {
		filters.RESPONSIBLE_ID = selectedEmployees.value
	}

	if (selectedStatuses.value.length > 0) {
		filters.STATUS = selectedStatuses.value
	}

	if (dateRange.value && dateRange.value.length > 0) {
		if (dateRange.value.length >= 1) {
			filters[">=CLOSED_DATE"] = dateRange.value[0]
		}
		if (dateRange.value.length >= 2) {
			filters["<=CLOSED_DATE"] = dateRange.value[dateRange.value.length - 1]
		}
	}

	return filters
})

// --- Computed Properties for Table ---
const userMap = computed(() => {
	return allUsers.value.reduce((acc, user) => {
		acc[user.ID] = user.name
		return acc
	}, {})
})

// Promisify BX24.callMethod to use with async/await
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

const fetchInitialData = async () => {
	if (!BX24) {
		error.value = "BX24 object is not available."
		return
	}

	loading.value = true
	try {
		BX24.callMethod("user.get", { ACTIVE: true }, result => {
			if (result.error()) {
				console.error(result.error())
				error.value = "Не удалось загрузить список сотрудников."
			} else {
				allUsers.value = result.data().map(user => ({
					ID: user.ID, // Keep it as string for consistency
					name: `${user.NAME} ${user.LAST_NAME}`.trim(),
				}))
			}
		})
	} catch (err) {
		console.error(err)
		error.value = "Ошибка при запросе списка сотрудников."
	} finally {
		loading.value = false
	}
}

onMounted(() => {
	fetchInitialData()
})
</script>

<style>
/* Global styles if needed */
.v-row {
	justify-content: space-between;
}
.v-card .v-card-text {
	padding: 16px; /* Re-add default padding, can be overridden by utility classes */
}

/* Стили для иконки календаря */
.date-picker-field .v-input__prepend .mdi-calendar {
	color: var(--v-theme-primary);
	font-size: 20px;
}

.v-input__prepend {
	margin-right: 0 !important;
}
</style>
