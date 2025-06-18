<template>
	<v-card>
		<v-card-title class="pb-4 d-flex align-center">
			Отчет по заработанным деньгам
			<v-icon class="ml-2" size="small" @click="faqDialog = true">
				mdi-information-outline
			</v-icon>
		</v-card-title>
		<v-card-text>
			<!-- Filters -->
			<v-row align="center">
				<v-col cols="12" sm="6" md="4">
					<v-autocomplete
						label="Компания"
						:items="allCompanies"
						v-model="selectedCompanies"
						item-title="title"
						item-value="ID"
						multiple
						clearable
						chips
						closable-chips
					>
						<template v-slot:item="{ props, item }">
							<v-list-item v-bind="props" :title="item.raw.title">
								<template v-slot:prepend>
									<v-checkbox-btn
										:model-value="selectedCompanies.includes(item.raw.ID)"
									></v-checkbox-btn>
								</template>
							</v-list-item>
						</template>
					</v-autocomplete>
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
								label="Период завершения сделки"
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
			</v-row>

			<!-- Отчет по компаниям -->
			<CompanyReport :filters="filters" :loading="loading" />
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
						заработанным деньгам на основе данных из вашего Битрикс24.
					</p>
					<br />
					<p><strong>Показатели:</strong></p>
					<ul>
						<li><strong>Компания:</strong> Название компании.</li>
						<li>
							<strong>Дата создания компании:</strong> Когда была создана
							компания.
						</li>
						<li>
							<strong>Кол-во заключенных сделок:</strong> Число успешно закрытых
							сделок с компанией.
						</li>
						<li>
							<strong>Сумма заключенных сделок:</strong> Общая сумма по всем
							успешно заключенным сделкам.
						</li>
						<li>
							<strong>Сумма незаключенных сделок:</strong> Общая сумма по всем
							незаключенным сделкам.
						</li>
					</ul>
					<br />
					<p><strong>Фильтры:</strong></p>
					<ul>
						<li>
							<strong>Компания:</strong> Выберите одну или несколько компаний
							для фильтрации отчета.
						</li>
						<li>
							<strong>Период завершения сделки:</strong> Укажите диапазон дат, в
							который сделки были завершены.
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
import { fetchEntities } from "../utils/bx24Api"
import CompanyReport from "./reports/CompanyReport.vue"

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

// Filters
const selectedCompanies = ref([])
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
const allCompanies = ref([]) // Для фильтра компаний

// Общие фильтры для передачи в дочерние компоненты
const filters = computed(() => {
	const filterObj = {}

	if (selectedCompanies.value.length > 0) {
		filterObj.COMPANY_ID = selectedCompanies.value
	}

	if (dateRange.value && dateRange.value.length > 0) {
		if (dateRange.value.length >= 1) {
			filterObj[">=CLOSEDATE"] = dateRange.value[0]
		}
		if (dateRange.value.length >= 2) {
			filterObj["<=CLOSEDATE"] = dateRange.value[dateRange.value.length - 1]
		}
	}

	return filterObj
})

const fetchInitialData = async () => {
	if (!BX24) {
		error.value = "BX24 object is not available."
		return
	}

	loading.value = true
	try {
		// Загружаем список компаний используя метод fetchEntities с пакетными запросами
		const companies = await fetchEntities(BX24, "crm.company", {
			select: ["ID", "TITLE", "DATE_CREATE"],
			order: { TITLE: "ASC" },
			useBatch: true, // Используем пакетные запросы для улучшения производительности
		})

		allCompanies.value = companies.map(company => ({
			ID: company.ID,
			title: company.TITLE,
			dateCreate: company.DATE_CREATE,
		}))
	} catch (err) {
		console.error("Ошибка при загрузке списка компаний:", err)
		error.value =
			"Ошибка при запросе списка компаний. Попробуйте позже или обратитесь в службу поддержки."
		allCompanies.value = []
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
