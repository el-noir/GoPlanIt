export interface AmadeusCity {
  id: string
  name: string
  iataCode: string
  geoCode: {
    latitude: number
    longitude: number
  }
  address: {
    countryCode: string
    stateCode?: string
  }
  timeZone: string
}

export interface AmadeusActivity {
  id: string
  name: string
  shortDescription: string
  geoCode: {
    latitude: number
    longitude: number
  }
  rating?: number
  pictures?: string[]
  bookingLink?: string
  price?: {
    currencyCode: string
    amount: string
  }
  minimumDuration?: string
}

export interface AmadeusTripPurpose {
  id: string
  origin: string
  destination: string
  departureDate: string
  returnDate?: string
  result: {
    category: "LEISURE" | "BUSINESS"
    probability: string
  }
}

export interface AmadeusTransferOffer {
  id: string
  transferType: "PRIVATE" | "SHARED" | "TAXI"
  start: {
    dateTime: string
    locationCode: string
  }
  end: {
    dateTime: string
    locationCode: string
  }
  duration: string
  vehicle: {
    code: string
    category: string
    description: string
  }
  quotation: {
    monetaryAmount: string
    currencyCode: string
  }
}

export interface RedisOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string | null;
  db?: number;
  family?: number; // 4 (IPv4) or 6 (IPv6)
  connectTimeout?: number;
  commandTimeout?: number;
  keepAlive?: number;
  noDelay?: boolean;
  connectionName?: string;
  tls?: any;
  retryStrategy?: (times: number) => number | void | null;
  maxRetriesPerRequest?: number;
  enableOfflineQueue?: boolean;
  enableReadyCheck?: boolean;
  autoResubscribe?: boolean;
  autoResendUnfulfilledCommands?: boolean;
}