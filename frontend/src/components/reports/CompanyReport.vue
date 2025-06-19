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
			<template v-slot:item.company="{ item }">
				<a
					href="#"
					@click.prevent="openCompanyCard(item.id)"
					class="company-link"
				>
					{{ item.company }}
				</a>
			</template>
			<template v-slot:item.closedDealsAmount="{ item }">
				{{ formatCurrency(item.closedDealsAmount) }}
			</template>
			<template v-slot:item.openDealsAmount="{ item }">
				{{ formatCurrency(item.openDealsAmount) }}
			</template>
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
		// Get the list of companies
		const companyFilter = {}
		if (props.filters.COMPANY_ID && props.filters.COMPANY_ID.length > 0) {
			companyFilter.ID = props.filters.COMPANY_ID
		}

		const companies = await fetchEntities(BX24, "crm.company", {
			select: ["ID", "TITLE", "DATE_CREATE"],
			filter: companyFilter,
			order: { TITLE: "ASC" },
			useBatch: true,
		})

		dealsByCompany.value = {}

		if (companies.length === 0) {
			companyData.value = []
			isLoading.value = false
			return
		}

		const dealFilter = {}
		if (props.filters[">=CLOSEDATE"]) {
			dealFilter[">=CLOSEDATE"] = props.filters[">=CLOSEDATE"]
		}
		if (props.filters["<=CLOSEDATE"]) {
			dealFilter["<=CLOSEDATE"] = props.filters["<=CLOSEDATE"]
		}

		const companyIds = companies.map(company => company.ID)

		// Fetch deals for all companies
		const dealsDataByCompany = await fetchRelatedEntitiesForMultiple(
			BX24,
			"crm.deal",
			"COMPANY_ID",
			companyIds,
			{
				select: ["ID", "OPPORTUNITY", "CLOSED", "COMPANY_ID"],
				filter: dealFilter,
				useBatch: true,
			}
		)

		// Process deals for each company
		companyIds.forEach(companyId => {
			const dealsData = dealsDataByCompany[companyId] || []
			const closedDeals = dealsData.filter(deal => deal.CLOSED === "Y")
			const openDeals = dealsData.filter(deal => deal.CLOSED !== "Y")

			dealsByCompany.value[companyId] = {
				closedDealsCount: closedDeals.length,
				closedDealsAmount: closedDeals.reduce(
					(sum, deal) => sum + parseFloat(deal.OPPORTUNITY || 0),
					0
				),
				openDealsAmount: openDeals.reduce(
					(sum, deal) => sum + parseFloat(deal.OPPORTUNITY || 0),
					0
				),
			}
		})

		// Group companies by title to aggregate data
		const companiesGroupedByTitle = companies.reduce((acc, company) => {
			if (!acc[company.TITLE]) {
				acc[company.TITLE] = []
			}
			acc[company.TITLE].push(company)
			return acc
		}, {})

		// Create aggregated data for the table
		const aggregatedData = Object.entries(companiesGroupedByTitle).map(
			([title, companiesInGroup]) => {
				const representativeId = companiesInGroup[0].ID
				let earliestDate = new Date(companiesInGroup[0].DATE_CREATE)

				const totals = companiesInGroup.reduce(
					(acc, company) => {
						const dealInfo = dealsByCompany.value[company.ID]
						const createDate = new Date(company.DATE_CREATE)

						if (createDate < earliestDate) {
							earliestDate = createDate
						}

						if (dealInfo) {
							acc.closedDealsCount += dealInfo.closedDealsCount
							acc.closedDealsAmount += dealInfo.closedDealsAmount
							acc.openDealsAmount += dealInfo.openDealsAmount
						}
						return acc
					},
					{
						closedDealsCount: 0,
						closedDealsAmount: 0,
						openDealsAmount: 0,
					}
				)

				return {
					id: representativeId,
					company: title,
					dateCreated: formatDate(earliestDate.toISOString()),
					...totals,
				}
			}
		)

		companyData.value = aggregatedData.sort((a, b) =>
			a.company.localeCompare(b.company)
		)
	} catch (e) {
		// Log error for developers, but don't show to user unless necessary
		console.error("Failed to load company report data:", e)
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

// --- Methods ---
const openCompanyCard = companyId => {
	if (BX24) {
		BX24.openPath(`/crm/company/details/${companyId}/`)
	}
}
</script>

<style scoped>
.company-link {
	color: #1e88e5; /* Vuetify's primary blue color */
	text-decoration: none;
	font-weight: 500;
}
.company-link:hover {
	text-decoration: underline;
}

/* Стили для таблицы */
.v-data-table {
	border-radius: 4px;
	overflow: hidden;
}
</style>
