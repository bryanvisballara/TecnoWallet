import { Redirect } from 'expo-router';

/** El tab Finanzas abre un menú en la barra; esta ruta no se usa como pantalla. */
export default function FinanzasTabPlaceholder() {
  return <Redirect href="/(tabs)/inicio" />;
}
