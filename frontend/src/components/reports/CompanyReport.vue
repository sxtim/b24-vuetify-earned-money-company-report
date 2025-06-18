<template>
	<div>
		<v-data-table
			v-model:items-per-page="itemsPerPage"
			:headers="headers"
			:items="companyData"
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
				<v-col cols="2"
					>Кол-во заключенных сделок: {{ totalClosedDeals }}</v-col
				>
				<v-col cols="2"
					>Сумма заключенных сделок:
					{{ formatCurrency(totalClosedAmount) }}</v-col
				>
				<v-col cols="2"
					>Сумма незаключенных сделок:
					{{ formatCurrency(totalOpenAmount) }}</v-col
				>
			</v-row>
		</v-card-text>
	</div>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from "vue"
import {
	fetchEntities,
	fetchRelatedEntities,
	fetchRelatedEntitiesForMultiple,
} from "../../utils/bx24Api"

const props = defineProps({
	filters: {
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
const companyData = ref([])
const dealsByCompany = ref({})

// Headers for the table
const headers = [
	{ title: "Компания", key: "company", sortable: true },
	{ title: "Дата создания", key: "dateCreated", sortable: true },
	{
		title: "Кол-во заключенных сделок",
		key: "closedDealsCount",
		sortable: true,
	},
	{
		title: "Сумма заключенных сделок",
		key: "closedDealsAmount",
		sortable: true,
	},
	{
		title: "Сумма незаключенных сделок",
		key: "openDealsAmount",
		sortable: true,
	},
]

// Helper function to format currency
const formatCurrency = amount => {
	return new Intl.NumberFormat("ru-RU", {
		style: "currency",
		currency: "RUB",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount)
}

// Format date
const formatDate = dateString => {
	const date = new Date(dateString)
	return date.toLocaleDateString("ru-RU", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	})
}

// Total metrics
const totalClosedDeals = computed(() => {
	return companyData.value.reduce(
		(sum, company) => sum + company.closedDealsCount,
		0
	)
})

const totalClosedAmount = computed(() => {
	return companyData.value.reduce(
		(sum, company) => sum + company.closedDealsAmount,
		0
	)
})

const totalOpenAmount = computed(() => {
	return companyData.value.reduce(
		(sum, company) => sum + company.openDealsAmount,
		0
	)
})

// Load companies and their deals
const loadCompaniesData = async () => {
	isLoading.value = true

	try {
		// Получаем список компаний
		const companyFilter = {}
		if (props.filters.COMPANY_ID && props.filters.COMPANY_ID.length > 0) {
			companyFilter.ID = props.filters.COMPANY_ID
		}

		// Получаем компании с использованием пакетных запросов
		const companiesData = await fetchEntities(BX24, "crm.company", {
			select: ["ID", "TITLE", "DATE_CREATE"],
			filter: companyFilter,
			order: { TITLE: "ASC" },
			useBatch: true,
		})

		// Сбрасываем данные о сделках компаний
		dealsByCompany.value = {}

		if (companiesData.length === 0) {
			companyData.value = []
			isLoading.value = false
			return
		}

		// Строим фильтр для сделок
		const dealFilter = {}

		// Добавляем фильтры дат, если они есть
		if (props.filters[">=CLOSEDATE"]) {
			dealFilter[">=CLOSEDATE"] = props.filters[">=CLOSEDATE"]
		}
		if (props.filters["<=CLOSEDATE"]) {
			dealFilter["<=CLOSEDATE"] = props.filters["<=CLOSEDATE"]
		}

		// Получаем ID всех компаний
		const companyIds = companiesData.map(company => company.ID)

		try {
			// Получаем сделки для всех компаний одним запросом
			const dealsDataByCompany = await fetchRelatedEntitiesForMultiple(
				BX24,
				"crm.deal",
				"COMPANY_ID",
				companyIds,
				{
					select: [
						"ID",
						"TITLE",
						"OPPORTUNITY",
						"STAGE_ID",
						"CLOSED",
						"CLOSEDATE",
						"COMPANY_ID",
					],
					filter: dealFilter,
					useBatch: true,
				}
			)

			// Обрабатываем полученные сделки для каждой компании
			companyIds.forEach(companyId => {
				const dealsData = dealsDataByCompany[companyId] || []

				// Группируем сделки по статусу (закрытые/незакрытые)
				const closedDeals = dealsData.filter(deal => deal.CLOSED === "Y")
				const openDeals = dealsData.filter(deal => deal.CLOSED !== "Y")

				// Считаем суммы
				const closedDealsAmount = closedDeals.reduce(
					(sum, deal) => sum + parseFloat(deal.OPPORTUNITY || 0),
					0
				)

				const openDealsAmount = openDeals.reduce(
					(sum, deal) => sum + parseFloat(deal.OPPORTUNITY || 0),
					0
				)

				// Сохраняем данные для компании
				dealsByCompany.value[companyId] = {
					closedDeals,
					openDeals,
					closedDealsCount: closedDeals.length,
					closedDealsAmount,
					openDealsAmount,
				}
			})
		} catch (dealsError) {
			console.error("Ошибка при загрузке сделок для компаний:", dealsError)

			// Если не удалось загрузить сделки пакетным запросом, пробуем загрузить по одной компании
			console.warn(
				"Переключаемся на последовательную загрузку сделок для компаний"
			)

			for (const company of companiesData) {
				const companyId = company.ID

				try {
					// Получаем сделки для компании обычным запросом
					const dealsData = await fetchRelatedEntities(
						BX24,
						"crm.deal",
						"COMPANY_ID",
						companyId,
						{
							select: [
								"ID",
								"TITLE",
								"OPPORTUNITY",
								"STAGE_ID",
								"CLOSED",
								"CLOSEDATE",
							],
							filter: dealFilter,
							useBatch: false,
						}
					)

					// Группируем сделки по статусу (закрытые/незакрытые)
					const closedDeals = dealsData.filter(deal => deal.CLOSED === "Y")
					const openDeals = dealsData.filter(deal => deal.CLOSED !== "Y")

					// Считаем суммы
					const closedDealsAmount = closedDeals.reduce(
						(sum, deal) => sum + parseFloat(deal.OPPORTUNITY || 0),
						0
					)

					const openDealsAmount = openDeals.reduce(
						(sum, deal) => sum + parseFloat(deal.OPPORTUNITY || 0),
						0
					)

					// Сохраняем данные для компании
					dealsByCompany.value[companyId] = {
						closedDeals,
						openDeals,
						closedDealsCount: closedDeals.length,
						closedDealsAmount,
						openDealsAmount,
					}
				} catch (dealError) {
					console.error(
						`Ошибка при загрузке сделок для компании ${companyId}:`,
						dealError
					)
					// Обработка ошибки для одной компании не должна прерывать общую загрузку
					dealsByCompany.value[companyId] = {
						closedDeals: [],
						openDeals: [],
						closedDealsCount: 0,
						closedDealsAmount: 0,
						openDealsAmount: 0,
					}
				}
			}
		}

		// Формируем данные для таблицы
		companyData.value = companiesData.map(company => ({
			id: company.ID,
			company: company.TITLE,
			dateCreated: formatDate(company.DATE_CREATE),
			closedDealsCount: dealsByCompany.value[company.ID]?.closedDealsCount || 0,
			closedDealsAmount:
				dealsByCompany.value[company.ID]?.closedDealsAmount || 0,
			openDealsAmount: dealsByCompany.value[company.ID]?.openDealsAmount || 0,
		}))
	} catch (e) {
		console.error("Failed to load company data:", e)
		companyData.value = []
	} finally {
		isLoading.value = false
	}
}

// Reload data when filters change
watch(
	() => props.filters,
	() => {
		loadCompaniesData()
	},
	{ deep: true }
)

// Load data on component mount
onMounted(() => {
	loadCompaniesData()
})
</script>

<style>
/* Стили для таблицы */
.v-data-table {
	border-radius: 4px;
	overflow: hidden;
}
</style>
