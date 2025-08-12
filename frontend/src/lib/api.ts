const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

export const api = {
  async createUserPreference(data: any) {
    const response = await fetch(`${API_BASE_URL}/api/user-preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  },

  async getUserPreference(id: string) {
    const response = await fetch(`${API_BASE_URL}/api/user-preferences/${id}`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  },

  async getProcessingStatus(id: string) {
    const response = await fetch(`${API_BASE_URL}/api/user-preferences/status/${id}`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  },
}
