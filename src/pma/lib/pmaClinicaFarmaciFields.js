import { parseFarmaciCatalogoFromFirestore, serializeFarmaciCatalogo } from '../types/farmaciCatalogo'
import {
  legacyCatalogFromConsumatiField,
  parseFarmaciConsumatiFromFirestore,
  serializeFarmaciConsumati,
} from '../types/farmaciConsumatiStats'

/** Separa catalogo selezionabile (`farmaci`) e statistiche utilizzo (`farmaci_consumati`). */
export function resolvePmaClinicaFarmaciFields(pmaClinica) {
  const pc = pmaClinica ?? {}
  const catalogFromFarmaci = parseFarmaciCatalogoFromFirestore(pc.farmaci)
  const legacyInConsumati = legacyCatalogFromConsumatiField(pc.farmaci_consumati)
  const catalogFromLegacy =
    catalogFromFarmaci.length > 0
      ? catalogFromFarmaci
      : parseFarmaciCatalogoFromFirestore(legacyInConsumati)
  const consumati = parseFarmaciConsumatiFromFirestore(pc.farmaci_consumati)
  return {
    farmaci: serializeFarmaciCatalogo(catalogFromLegacy),
    farmaci_consumati: serializeFarmaciConsumati(consumati),
  }
}
