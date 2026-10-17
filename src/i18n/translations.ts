import { STANDARD_LANGUAGE } from './lang'

/*
 * Types
 */

type Translations = Record<string, Record<string, string>>

type translateFnType = (key: string, ...args: any[]) => string

export type LocaleType = {
  lang: string
  t: translateFnType
}

/*
 * Functions
 */

export function translate(lang: string, key: string, args: string[]): string {
  let translation = translations[lang]?.[key] || translations[STANDARD_LANGUAGE]?.[key] || key

  // placeholder replacement
  for (let i = 0; i < args.length; i++) {
    translation = translation.replace(new RegExp('\\{' + i + '\\}', 'g'), args[i])
  }

  return translation
}

export function newLocale(lang: string): LocaleType {
  const t = function (key: string, ...args: string[]) {
    return translate(lang, key, args)
  }
  return { lang, t }
}

/*
 * Variables
 */

const translations: Translations = {
  // Technically the English to English translation is not needed,
  // but it serves as the primary set for translations in other languages.
  en: {
    'Skip to main content': 'Skip to main content',
    'Toggle dark mode': 'Toggle dark mode',
    'Choose site language': 'Choose site language',
    'Add product': 'Add product',
    'Refresh list': 'Refresh list',
    'Search': 'Search',
    'Filter products by name, description or price': 'Filter products by name, description or price',
    'Filter products by the starting letters of the product name': 'Filter products by the starting letters of the product name',
    'Loading': 'Loading',
    'Name': 'Name',
    'Description': 'Description',
    'Price': 'Price',
    'Actions': 'Actions',
    'Edit': 'Edit',
    'Delete': 'Delete',
    'No products available': 'No products available',
    'No products match your search': 'No products match your search',
    'A product with this name already exists': 'A product with this name already exists',
    'Create': 'Create',
    'Cancel': 'Cancel',
    'Edit product': 'Edit product',
    'Save': 'Save',
    'Delete {0}': 'Delete {0}',
    'Are you sure you want to delete this product?': 'Are you sure you want to delete this product?',
    'Product name is required': 'Product name is required',
    'Product name must be at most 20 characters': 'Product name must be at most 20 characters',
    'Description must be at most 300 characters': 'Description must be at most 300 characters',
    'Price must be a non-negative number': 'Price must be a non-negative number',
    'Price must have at most 2 decimal places': 'Price must have at most 2 decimal places',
    'Could not create product': 'Could not create product',
    'Could not update product': 'Could not update product',
    "'{0}' is changed or removed by another user. Reopen it from the list.":
      "'{0}' is changed or removed by another user. Reopen it from the list.",
  },
  es: {
    'Skip to main content': 'Saltar al contenido principal',
    'Toggle dark mode': 'Cambiar el modo oscuro',
    'Choose site language': 'Elegir el idioma del sitio',
    'Add product': 'Agregar producto',
    'Refresh list': 'Actualizar lista',
    'Search': 'Buscar',
    'Filter products by name, description or price': 'Filtrar productos por nombre, descripción o precio',
    'Filter products by the starting letters of the product name': 'Filtrar productos por las letras iniciales del nombre del producto',
    'Loading': 'Cargando',
    'Name': 'Nombre',
    'Description': 'Descripción',
    'Price': 'Precio',
    'Actions': 'Acciones',
    'Edit': 'Editar',
    'Delete': 'Eliminar',
    'No products available': 'No hay productos disponibles',
    'No products match your search': 'Ningún producto coincide con tu búsqueda',
    'A product with this name already exists': 'Ya existe un producto con este nombre',
    'Create': 'Crear',
    'Cancel': 'Cancelar',
    'Edit product': 'Editar producto',
    'Save': 'Guardar',
    'Delete {0}': 'Eliminar {0}',
    'Are you sure you want to delete this product?': '¿Seguro que quieres eliminar este producto?',
    'Product name is required': 'El nombre del producto es obligatorio',
    'Product name must be at most 20 characters': 'El nombre del producto debe tener como máximo 20 caracteres',
    'Description must be at most 300 characters': 'La descripción debe tener como máximo 300 caracteres',
    'Price must be a non-negative number': 'El precio debe ser un número no negativo',
    'Price must have at most 2 decimal places': 'El precio debe tener como máximo 2 decimales',
    'Could not create product': 'No se pudo crear el producto',
    'Could not update product': 'No se pudo actualizar el producto',
    "'{0}' is changed or removed by another user. Reopen it from the list.":
      "'{0}' fue cambiado o eliminado por otro usuario. Vuelve a abrirlo desde la lista.",
  },
  fr: {
    'Skip to main content': 'Passer au contenu principal',
    'Toggle dark mode': 'Basculer le mode sombre',
    'Choose site language': 'Choisir la langue du site',
    'Add product': 'Ajouter un produit',
    'Refresh list': 'Actualiser la liste',
    'Search': 'Rechercher',
    'Filter products by name, description or price': 'Filtrer les produits par nom, description ou prix',
    'Filter products by the starting letters of the product name': 'Filtrer les produits par les lettres initiales du nom du produit',
    'Loading': 'Chargement',
    'Name': 'Nom',
    'Description': 'Description',
    'Price': 'Prix',
    'Actions': 'Actions',
    'Edit': 'Modifier',
    'Delete': 'Supprimer',
    'No products available': 'Aucun produit disponible',
    'No products match your search': 'Aucun produit ne correspond à votre recherche',
    'A product with this name already exists': 'Un produit avec ce nom existe déjà',
    'Create': 'Créer',
    'Cancel': 'Annuler',
    'Edit product': 'Modifier le produit',
    'Save': 'Enregistrer',
    'Delete {0}': 'Supprimer {0}',
    'Are you sure you want to delete this product?': 'Voulez-vous vraiment supprimer ce produit ?',
    'Product name is required': 'Le nom du produit est requis',
    'Product name must be at most 20 characters': 'Le nom du produit doit comporter au plus 20 caractères',
    'Description must be at most 300 characters': 'La description doit comporter au plus 300 caractères',
    'Price must be a non-negative number': 'Le prix doit être un nombre non négatif',
    'Price must have at most 2 decimal places': 'Le prix doit comporter au plus 2 décimales',
    'Could not create product': 'Impossible de créer le produit',
    'Could not update product': 'Impossible de mettre à jour le produit',
    "'{0}' is changed or removed by another user. Reopen it from the list.":
      "'{0}' a été modifié ou supprimé par un autre utilisateur. Rouvrez-le depuis la liste.",
  },
  de: {
    'Skip to main content': 'Zum Hauptinhalt springen',
    'Toggle dark mode': 'Dunkelmodus umschalten',
    'Choose site language': 'Sprache der Website auswählen',
    'Add product': 'Produkt hinzufügen',
    'Refresh list': 'Liste aktualisieren',
    'Search': 'Suchen',
    'Filter products by name, description or price': 'Produkte nach Name, Beschreibung oder Preis filtern',
    'Filter products by the starting letters of the product name': 'Produkte nach den Anfangsbuchstaben des Produktnamens filtern',
    'Loading': 'Wird geladen',
    'Name': 'Name',
    'Description': 'Beschreibung',
    'Price': 'Preis',
    'Actions': 'Aktionen',
    'Edit': 'Bearbeiten',
    'Delete': 'Löschen',
    'No products available': 'Keine Produkte verfügbar',
    'No products match your search': 'Keine Produkte entsprechen Ihrer Suche',
    'A product with this name already exists': 'Ein Produkt mit diesem Namen existiert bereits',
    'Create': 'Erstellen',
    'Cancel': 'Abbrechen',
    'Edit product': 'Produkt bearbeiten',
    'Save': 'Speichern',
    'Delete {0}': '{0} löschen',
    'Are you sure you want to delete this product?': 'Möchten Sie dieses Produkt wirklich löschen?',
    'Product name is required': 'Produktname ist erforderlich',
    'Product name must be at most 20 characters': 'Produktname darf höchstens 20 Zeichen haben',
    'Description must be at most 300 characters': 'Beschreibung darf höchstens 300 Zeichen haben',
    'Price must be a non-negative number': 'Preis muss eine nicht-negative Zahl sein',
    'Price must have at most 2 decimal places': 'Preis darf höchstens 2 Nachkommastellen haben',
    'Could not create product': 'Produkt konnte nicht erstellt werden',
    'Could not update product': 'Produkt konnte nicht aktualisiert werden',
    "'{0}' is changed or removed by another user. Reopen it from the list.":
      "'{0}' wurde von einem anderen Benutzer geändert oder entfernt. Öffnen Sie es erneut aus der Liste.",
  },
}
