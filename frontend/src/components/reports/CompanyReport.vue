<template>
	<div>
		<v-data-table
			v-model:items-per-page="itemsPerPage"
			v-model:page="currentPage"
			:headers="headers"
			:items="companyData"
			:loading="isLoading"
			class="elevation-1"
			item-value="id"
			:items-per-page-options="itemsPerPageOptions"
			hide-default-footer
			hover
		>
			<template v-slot:item.company="{ item }">
				<a
					v-if="item.companyId"
					href="#"
					@click.prevent="openCompanyCard(item.companyId)"
					class="company-link"
				>
					{{ item.company }}
				</a>
				<span v-else>{{ item.company }}</span>
			</template>
			<template v-slot:item.closedDealsCount="{ item }">
				<a
					href="#"
					@click.prevent="showDealsModal(item)"
					v-if="item.closedDealsCount > 0"
					class="company-link"
				>
					{{ item.closedDealsCount }}
				</a>
				<span v-else>0</span>
			</template>
			<template v-slot:item.closedDealsAmount="{ item }">
				{{ formatCurrency(item.closedDealsAmount) }}
			</template>
			<template v-slot:item.openDealsAmount="{ item }">
				{{ formatCurrency(item.openDealsAmount) }}
			</template>
			<template v-slot:item.openDealsCount="{ item }">
				<a
					href="#"
					@click.prevent="showOpenDealsModal(item)"
					v-if="item.openDealsCount > 0"
					class="company-link"
				>
					{{ item.openDealsCount }}
				</a>
				<span v-else>0</span>
			</template>
			<template v-slot:loading>
				<v-skeleton-loader type="table-row@5"></v-skeleton-loader>
			</template>

			<template v-slot:bottom>
				<div class="d-flex align-center pa-2 pagination-controls">
					<div class="text-caption">Всего: {{ companyData.length }}</div>
					<v-spacer></v-spacer>
					<div class="d-flex align-center">
						<span class="text-caption mr-2">Строк на странице:</span>
						<v-select
							v-model="itemsPerPage"
							:items="itemsPerPageOptions"
							density="compact"
							variant="outlined"
							hide-details
							style="max-width: 100px"
							class="mr-4"
						></v-select>
						<v-pagination
							v-model="currentPage"
							:length="pageCount"
							:total-visible="7"
						></v-pagination>
					</div>
				</div>
			</template>
		</v-data-table>

		<!-- Summary Information -->
		<v-card-text class="pa-2 mt-4">
			<v-row justify="end" class="font-weight-bold">
				<v-col cols="auto">Общий итог:</v-col>
				<v-col cols="auto">Заключенные сделки: {{ totalClosedDeals }}</v-col>
				<v-col cols="auto">Незаключенные сделки: {{ totalOpenDeals }}</v-col>
				<v-col cols="auto"
					>Сумма заключенных: {{ formatCurrency(totalClosedAmount) }}</v-col
				>
				<v-col cols="auto"
					>Сумма незаключенных: {{ formatCurrency(totalOpenAmount) }}</v-col
				>
			</v-row>
		</v-card-text>

		<!-- Deals Modal -->
		<v-dialog v-model="dealsModalVisible" max-width="900px">
			<v-card>
				<v-card-title>
					<span class="text-h5" :class="modalTitleColor">{{ modalTitle }}</span>
				</v-card-title>
				<v-card-text>
					<v-data-table
						:headers="dealsHeaders"
						:items="selectedCompanyDeals"
						class="elevation-1"
						item-value="id"
						:row-props="dealRowProps"
						hover
					>
						<template v-slot:item.title="{ item }">
							<a
								href="#"
								@click.prevent="openDealCard(item.id)"
								class="company-link"
							>
								{{ item.title }}
							</a>
						</template>
						<template v-slot:item.opportunity="{ item }">
							{{ formatCurrency(item.opportunity) }}
						</template>
						<template v-slot:item.manager="{ item }">
							{{ item.manager }}
						</template>
					</v-data-table>
				</v-card-text>
				<v-card-actions>
					<v-spacer></v-spacer>
					<v-btn color="primary" text @click="dealsModalVisible = false"
						>Закрыть</v-btn
					>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</div>
</template>

<script setup>
import { computed, inject, ref, watch } from "vue"
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
const currentPage = ref(1)
const itemsPerPageOptions = [
	{ value: 10, title: "10" },
	{ value: 25, title: "25" },
	{ value: 50, title: "50" },
]
const isLoading = ref(false)
const companyData = ref([])
const dealsByCompany = ref({})
const dealCollectionsByTitle = ref({})
const users = ref({}) // To store manager names

// Modal state
const dealsModalVisible = ref(false)
const selectedCompanyDeals = ref([])
const modalTitle = ref("")
const modalTitleColor = ref("")
const dealsHeaders = [
	{ title: "Название сделки", key: "title", sortable: true },
	{ title: "Сумма", key: "opportunity", sortable: true },
	{ title: "Ответственный", key: "manager", sortable: true },
]

// Pagination computed property
const pageCount = computed(() => {
	return Math.ceil(companyData.value.length / itemsPerPage.value)
})

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
		title: "Кол-во незаключенных сделок",
		key: "openDealsCount",
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

const totalOpenDeals = computed(() => {
	return companyData.value.reduce(
		(sum, company) => sum + company.openDealsCount,
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
				select: [
					"ID",
					"TITLE",
					"OPPORTUNITY",
					"CLOSED",
					"COMPANY_ID",
					"ASSIGNED_BY_ID",
					"STAGE_ID",
				],
				filter: dealFilter,
				useBatch: true,
			}
		)

		// Fetch users (managers)
		const userIds = new Set()
		Object.values(dealsDataByCompany)
			.flat()
			.forEach(deal => {
				if (deal.ASSIGNED_BY_ID) {
					userIds.add(deal.ASSIGNED_BY_ID)
				}
			})

		if (userIds.size > 0) {
			try {
				const usersData = await BX24.callMethod("user.get", {
					ID: [...userIds],
				})
				if (Array.isArray(usersData)) {
					users.value = usersData.reduce((acc, user) => {
						acc[user.ID] = `${user.NAME || ""} ${user.LAST_NAME || ""}`.trim()
						return acc
					}, {})
				}
			} catch (error) {
				console.error("Error fetching users:", error)
				// Если не удалось загрузить пользователей, просто оставим ID
			}
		}

		// Process deals for each company
		companyIds.forEach(companyId => {
			const dealsData = dealsDataByCompany[companyId] || []
			const closedDeals = dealsData.filter(
				deal => deal.CLOSED === "Y" && deal.STAGE_ID?.includes("WON")
			)
			const openDeals = dealsData.filter(
				deal => !(deal.CLOSED === "Y" && deal.STAGE_ID?.includes("WON"))
			)

			dealsByCompany.value[companyId] = {
				closedDealsCount: closedDeals.length,
				openDealsCount: openDeals.length,
				closedDealsAmount: closedDeals.reduce(
					(sum, deal) => sum + parseFloat(deal.OPPORTUNITY || 0),
					0
				),
				openDealsAmount: openDeals.reduce(
					(sum, deal) => sum + parseFloat(deal.OPPORTUNITY || 0),
					0
				),
				closedDeals: closedDeals, // Store raw deals for modal
				openDeals: openDeals, // Store raw open deals for modal
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

		const aggregatedDealsByTitle = {}

		// Create aggregated data for the table
		const aggregatedData = Object.entries(companiesGroupedByTitle).map(
			([title, companiesInGroup]) => {
				let earliestDate = new Date(companiesInGroup[0].DATE_CREATE)
				const allClosedDeals = []
				const allOpenDeals = []

				const totals = companiesInGroup.reduce(
					(acc, company) => {
						const dealInfo = dealsByCompany.value[company.ID]
						const createDate = new Date(company.DATE_CREATE)

						if (createDate < earliestDate) {
							earliestDate = createDate
						}

						if (dealInfo) {
							acc.closedDealsCount += dealInfo.closedDealsCount
							acc.openDealsCount += dealInfo.openDealsCount
							acc.closedDealsAmount += dealInfo.closedDealsAmount
							acc.openDealsAmount += dealInfo.openDealsAmount
							if (dealInfo.closedDeals) {
								allClosedDeals.push(...dealInfo.closedDeals)
							}
							if (dealInfo.openDeals) {
								allOpenDeals.push(...dealInfo.openDeals)
							}
						}
						return acc
					},
					{
						closedDealsCount: 0,
						openDealsCount: 0,
						closedDealsAmount: 0,
						openDealsAmount: 0,
					}
				)

				aggregatedDealsByTitle[title] = {
					closedDeals: allClosedDeals,
					openDeals: allOpenDeals,
				}

				return {
					id: title, // Use title for unique key
					company: title,
					companyId:
						companiesInGroup.length === 1 ? companiesInGroup[0].ID : null,
					dateCreated: formatDate(earliestDate.toISOString()),
					...totals,
				}
			}
		)
		dealCollectionsByTitle.value = aggregatedDealsByTitle
		companyData.value = aggregatedData.sort((a, b) =>
			a.company.localeCompare(b.company)
		)
	} catch (error) {
		console.error("Error loading company data:", error)
	} finally {
		isLoading.value = false
	}
}

watch(
	() => props.filters,
	() => {
		loadCompaniesData()
	},
	{ deep: true, immediate: true }
)

// --- Methods ---
const openCompanyCard = companyId => {
	if (BX24) {
		BX24.openPath(`/crm/company/details/${companyId}/`)
	}
}

const showDealsModal = company => {
	const dealCollection = dealCollectionsByTitle.value[company.company]
	if (dealCollection && dealCollection.closedDeals) {
		modalTitle.value = `Заключенные сделки для "${company.company}"`
		modalTitleColor.value = "text-green"
		selectedCompanyDeals.value = dealCollection.closedDeals.map(deal => ({
			id: deal.ID,
			title: deal.TITLE,
			opportunity: deal.OPPORTUNITY,
			manager: users.value[deal.ASSIGNED_BY_ID] || "Не назначен",
		}))
		dealsModalVisible.value = true
	}
}

const showOpenDealsModal = company => {
	const dealCollection = dealCollectionsByTitle.value[company.company]
	if (dealCollection && dealCollection.openDeals) {
		modalTitle.value = `Незаключенные сделки для "${company.company}"`
		modalTitleColor.value = "text-red"
		selectedCompanyDeals.value = dealCollection.openDeals.map(deal => ({
			id: deal.ID,
			title: deal.TITLE,
			opportunity: deal.OPPORTUNITY,
			manager: users.value[deal.ASSIGNED_BY_ID] || "Не назначен",
			isFailed: deal.CLOSED === "Y",
		}))
		dealsModalVisible.value = true
	}
}

const openDealCard = dealId => {
	if (BX24) {
		BX24.openPath(`/crm/deal/details/${dealId}/`)
	}
}

const dealRowProps = ({ item }) => {
	if (item.isFailed) {
		return { class: "failed-deal" }
	}
	return {}
}
</script>

<style scoped>
.company-link {
	color: #1e88e5;
	text-decoration: none;
	cursor: pointer;
}

.company-link:hover {
	text-decoration: underline;
}

.pagination-controls {
	width: 100%;
}

::v-deep .v-data-table thead {
	background-color: #f5f5f5;
}

::v-deep .failed-deal {
	color: #f44336; /* Vuetify's red color */
}

/* Ensure links inside a failed row are also red */
::v-deep .failed-deal a {
	color: inherit;
}
</style>
