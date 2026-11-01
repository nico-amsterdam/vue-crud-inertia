export type ProductBaseType = {
  productName: string
  description: string
  price: number | null
  modifiedAt: Date | null
}

export type ProductType = { id: number } & ProductBaseType

export type ProductErrorsType = {
  write?: string
  productName?: string
  description?: string
  price?: string
  modifiedAt?: string
}
