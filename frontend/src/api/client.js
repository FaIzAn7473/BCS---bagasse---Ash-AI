import axios from 'axios'

const api = axios.create({
  baseURL:  'https://bcs-bagasse-ash-ai.onrender.com',
  timeout: 30000,
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      err.message ||
      'An unexpected error occurred. Please try again.'
    return Promise.reject(new Error(message))
  }
)

export const predict = (ll, pl) =>
  api.post('/predict', { ll, pl }).then((r) => r.data)

export const getModelPerformance = () =>
  api.get('/model-performance').then((r) => r.data)

export const getDatasetSummary = () =>
  api.get('/dataset-summary').then((r) => r.data)

export const uploadDataset = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload-dataset', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data)
}

export const getHealth = () =>
  api.get('/health').then((r) => r.data)

export default api
