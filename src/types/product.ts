export type ProductBaseType = {
  productName: string
  description: string
  price: number | null
  modifiedAt: Date | string | null
}

export type ProductType = { id: number } & ProductBaseType
export type AddProductType = { id: number | null } & ProductBaseType
