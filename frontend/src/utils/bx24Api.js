/**
 * Утилиты для работы с API Битрикс24, включая методы для пагинации и пакетных запросов.
 */

/**
 * Вызов метода API Битрикс24 с поддержкой Promise и автоматической пагинацией.
 * @param {Object} BX24 - Инициализированный объект BX24
 * @param {string} method - Имя метода API Битрикс24
 * @param {Object} params - Параметры для вызова метода
 * @param {boolean} useAutoPagination - Использовать ли автоматическую пагинацию для получения всех результатов
 * @returns {Promise<Array>} - Promise с результатами вызова метода
 */
export const callBX24Method = (
	BX24,
	method,
	params = {},
	useAutoPagination = true
) => {
	return new Promise((resolve, reject) => {
		if (!BX24) {
			return reject(new Error("BX24 объект не доступен."))
		}

		let allResults = []

		// Основной вызов метода через встроенный объект BX24
		BX24.callMethod(method, params, function handleResponse(response) {
			if (response.error()) {
				console.error(`Ошибка при вызове ${method}:`, response.error())
				return reject(
					new Error(
						response.error().error_description || "Ошибка API Битрикс24"
					)
				)
			}

			// Добавляем полученные данные к результатам
			const data = response.data()
			allResults = allResults.concat(Array.isArray(data) ? data : [data])

			// Проверяем, есть ли еще данные и нужна ли пагинация
			if (useAutoPagination && response.more()) {
				// Используем встроенный механизм next() для пагинации
				response.next()
			} else {
				// Возвращаем все собранные результаты
				resolve({
					data: allResults,
					total: response.total ? response.total() : allResults.length,
				})
			}
		})
	})
}

/**
 * Вызов метода API Битрикс24 с оптимизированной пагинацией через пакетные запросы.
 * Используется для методов, которые возвращают большие объемы данных.
 * @param {Object} BX24 - Инициализированный объект BX24
 * @param {string} method - Имя метода API Битрикс24
 * @param {Object} params - Параметры для вызова метода
 * @returns {Promise<Array>} - Promise с результатами вызова метода
 */
export const callBX24MethodBatch = async (BX24, method, params = {}) => {
	// Первый запрос для получения общего количества элементов
	try {
		const initialResponse = await callBX24Method(BX24, method, params, false)

		const totalItems = initialResponse.total
		const initialData = initialResponse.data

		// Если все данные получены в первом запросе или их нет, возвращаем результат
		if (totalItems <= 50 || totalItems === 0) {
			return initialData
		}

		// Иначе готовим пакетные запросы
		const batchRequests = {}

		// Генерируем запросы для получения всех данных
		for (let start = 50; start < totalItems; start += 50) {
			const batchParams = { ...params, start }
			const batchKey = `${method}_${start}`
			batchRequests[batchKey] = { method, params: batchParams }
		}

		// Выполняем пакетный запрос через BX24.callBatch
		const batchResults = await executeBatchRequest(BX24, batchRequests)

		// Объединяем все результаты
		const allResults = [...initialData]

		Object.values(batchResults).forEach(result => {
			if (Array.isArray(result)) {
				allResults.push(...result)
			}
		})

		return allResults
	} catch (error) {
		console.error(`Ошибка при вызове ${method} с пакетными запросами:`, error)
		throw error
	}
}

/**
 * Выполняет пакетный запрос к API Битрикс24.
 * @param {Object} BX24 - Инициализированный объект BX24
 * @param {Object} batch - Объект с пакетными запросами
 * @returns {Promise<Object>} - Promise с результатами пакетного запроса
 */
const executeBatchRequest = (BX24, batch) => {
	return new Promise((resolve, reject) => {
		// Используем встроенный метод BX24.callBatch
		BX24.callBatch(
			batch,
			response => {
				try {
					const results = {}

					// Обрабатываем каждый ответ в пакете
					Object.entries(response).forEach(([key, result]) => {
						if (result.error && result.error()) {
							console.warn(`Ошибка в пакетном запросе ${key}:`, result.error())
							results[key] = []
						} else {
							results[key] = result.data()
						}
					})

					resolve(results)
				} catch (error) {
					console.error("Ошибка при обработке пакетного запроса:", error)
					reject(error)
				}
			},
			false // halt_on_error = false
		)
	})
}

/**
 * Выполняет запрос сущности из Битрикс24.
 * @param {Object} BX24 - Инициализированный объект BX24
 * @param {string} entityType - Тип сущности (crm.company, crm.deal, etc.)
 * @param {Object} options - Опции запроса (select, filter, order)
 * @returns {Promise<Array>} - Promise с результатами запроса
 */
export const fetchEntities = async (BX24, entityType, options = {}) => {
	const { select = [], filter = {}, order = {}, useBatch = true } = options

	const params = {
		select,
		filter,
		order,
	}

	// Для больших выборок используем пакетные запросы
	if (useBatch) {
		try {
			return await callBX24MethodBatch(BX24, `${entityType}.list`, params)
		} catch (error) {
			console.warn(
				`Ошибка при использовании пакетных запросов, переключаемся на обычный запрос: ${error.message}`
			)
			const result = await callBX24Method(BX24, `${entityType}.list`, params)
			return result.data
		}
	} else {
		const result = await callBX24Method(BX24, `${entityType}.list`, params)
		return result.data
	}
}

/**
 * Получает связанные сущности по родительской сущности.
 * Например, получение сделок для конкретной компании.
 * @param {Object} BX24 - Инициализированный объект BX24
 * @param {string} entityType - Тип сущности (crm.deal, etc.)
 * @param {string} parentField - Поле связи с родительской сущностью (COMPANY_ID, etc.)
 * @param {string} parentId - ID родительской сущности
 * @param {Object} options - Дополнительные опции запроса
 * @returns {Promise<Array>} - Promise с результатами запроса
 */
export const fetchRelatedEntities = async (
	BX24,
	entityType,
	parentField,
	parentId,
	options = {}
) => {
	const { select = [], filter = {}, order = {}, useBatch = true } = options

	// Добавляем фильтр по родительской сущности
	const entityFilter = {
		...filter,
		[parentField]: parentId,
	}

	return fetchEntities(BX24, entityType, {
		select,
		filter: entityFilter,
		order,
		useBatch,
	})
}

/**
 * Получает связанные сущности для нескольких родительских сущностей одновременно.
 * Например, получение сделок для нескольких компаний.
 * @param {Object} BX24 - Инициализированный объект BX24
 * @param {string} entityType - Тип сущности (crm.deal, etc.)
 * @param {string} parentField - Поле связи с родительской сущностью (COMPANY_ID, etc.)
 * @param {Array} parentIds - Массив ID родительских сущностей
 * @param {Object} options - Дополнительные опции запроса
 * @returns {Promise<Object>} - Promise с результатами запроса, сгруппированными по ID родительской сущности
 */
export const fetchRelatedEntitiesForMultiple = async (
	BX24,
	entityType,
	parentField,
	parentIds,
	options = {}
) => {
	const { select = [], filter = {}, order = {}, useBatch = true } = options

	// Добавляем фильтр по массиву родительских сущностей
	const entityFilter = {
		...filter,
		[parentField]: parentIds,
	}

	// Получаем все связанные сущности одним запросом
	const allEntities = await fetchEntities(BX24, entityType, {
		select,
		filter: entityFilter,
		order,
		useBatch,
	})

	// Группируем результаты по ID родительской сущности
	const groupedResults = {}

	// Инициализируем пустые массивы для каждого родительского ID
	parentIds.forEach(id => {
		groupedResults[id] = []
	})

	// Распределяем сущности по соответствующим группам
	allEntities.forEach(entity => {
		const parentId = entity[parentField]
		if (groupedResults[parentId]) {
			groupedResults[parentId].push(entity)
		}
	})

	return groupedResults
}
