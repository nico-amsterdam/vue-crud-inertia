import { describe, it, expect } from 'bun:test'
import { newLocale, translate } from '../../src/i18n/translations'

describe('translate', () => {
  describe('basic translations', () => {
    it('should translate to English', () => {
      expect(translate('en', 'Add product', [])).toBe('Add product')
    })

    it('should translate to Spanish', () => {
      expect(translate('es', 'Add product', [])).toBe('Agregar producto')
    })

    it('should translate to French', () => {
      expect(translate('fr', 'Add product', [])).toBe('Ajouter un produit')
    })

    it('should translate to German', () => {
      expect(translate('de', 'Add product', [])).toBe('Produkt hinzufügen')
    })

    it('should translate validation messages', () => {
      expect(translate('es', 'Product name is required', [])).toBe('El nombre del producto es obligatorio')
      expect(translate('de', 'Could not create product', [])).toBe('Produkt konnte nicht erstellt werden')
    })
  })

  describe('placeholder replacement', () => {
    it('should replace single placeholder {0}', () => {
      expect(translate('en', 'Delete {0}', ['Bread'])).toBe('Delete Bread')
      expect(translate('es', 'Delete {0}', ['Bread'])).toBe('Eliminar Bread')
      expect(translate('fr', 'Delete {0}', ['Bread'])).toBe('Supprimer Bread')
      expect(translate('de', 'Delete {0}', ['Bread'])).toBe('Bread löschen')
    })

    it('should handle empty args array', () => {
      expect(translate('en', 'Cancel', [])).toBe('Cancel')
    })
  })

  describe('fallback behavior', () => {
    it('should fallback to the key when the translation does not exist', () => {
      expect(translate('en', 'TotallyFakeKey12345', [])).toBe('TotallyFakeKey12345')
      expect(translate('es', 'TotallyFakeKey12345', [])).toBe('TotallyFakeKey12345')
    })

    it('should handle unknown language by falling back to English', () => {
      expect(translate('zh', 'Login', [])).toBe('Login')
      expect(translate('', 'Add product', [])).toBe('Add product')
    })
  })
})

describe('newLocale', () => {
  it('should return an object with lang and a translation function', () => {
    const locale = newLocale('en')
    expect(locale).toHaveProperty('lang', 'en')
    expect(typeof locale.t).toBe('function')
  })

  it('should return a working translation function', () => {
    const locale = newLocale('es')
    expect(locale.t('Add product')).toBe('Agregar producto')
    expect(locale.t('Name')).toBe('Nombre')
  })

  it('should pass multiple arguments for multiple placeholders', () => {
    expect(newLocale('en').t('Delete {0} {1}', 'a', 'b')).toBe('Delete a b')
  })
})
