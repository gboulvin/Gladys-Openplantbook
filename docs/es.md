# OpenPlantBook

Esta integración trae a Gladys la base de datos de plantas
[Open Plantbook](https://open.plantbook.io/): para cada una de sus plantas, los
**rangos ideales** de humedad del suelo, temperatura, luz y humedad del aire de
su especie. Combínelos con sus propios sensores (sonda de humedad del suelo,
sensor de temperatura o de luz) para saber cuándo una planta necesita agua, luz
o un lugar más cálido.

Funciona en la nube: necesita una conexión a Internet y una cuenta gratuita de
OpenPlantBook.

## Qué obtiene

- **Un dispositivo por planta**, con ocho funciones de solo lectura: el mínimo
  y el máximo de humedad del suelo (%), temperatura (°C o °F), luz (lux) y
  humedad del aire (%). Utilizables en el panel y en las condiciones de escena.
- **Disparadores de escena**, **acciones de escena** y **widgets**, descritos
  más abajo (Gladys 5.1 o posterior).

## Obtener sus credenciales de OpenPlantBook

1. Cree una cuenta gratuita en [open.plantbook.io](https://open.plantbook.io/).
2. Abra la página [API keys](https://open.plantbook.io/apikey/show/) y genere
   una clave: obtendrá un **client ID** y un **client secret**.

## Configuración

1. Abra la pestaña **Configuración** de la integración.
2. Pegue el **client ID** y el **client secret**.
3. Pulse **Probar la conexión** para comprobarlos.
4. Encuentre sus plantas con el botón **Buscar una planta**: escriba un nombre
   común o científico (`monstera`, `albahaca`, `rosa`...). La respuesta lista
   los identificadores OpenPlantBook, como `monstera deliciosa`.
5. Copie los identificadores en el campo **Plantas**, separados por comas (30
   plantas como máximo), por ejemplo
   `monstera deliciosa, ficus lyrata, ocimum basilicum`.
6. Elija el **idioma de los nombres de plantas** (inglés, francés, alemán o
   español), la **unidad de temperatura** y, si lo desea, el **intervalo de
   actualización** (24 horas por defecto: los umbrales cambian poco).
7. Guarde y añada las plantas desde la pestaña **Descubrimiento**.

Los umbrales se guardan en una caché local: tras un reinicio, o si
OpenPlantBook no está disponible, los dispositivos conservan sus últimos
valores.

> Consejo: no asigne un dispositivo planta a una habitación. Lleva _rangos_ de
> temperatura y humedad, no mediciones.

## Acciones

- **Probar la conexión**: comprueba las credenciales.
- **Buscar una planta**: busca en la base OpenPlantBook y lista los
  identificadores que copiar en el campo **Plantas**.
- **Actualizar todas las plantas ahora**: vuelve a leer todas las plantas sin
  esperar al intervalo de actualización.

## Escenas

La integración añade sus propias tarjetas al editor de escenas, en la categoría
**Integraciones**.

### Disparadores

- **Umbrales de planta actualizados**: los rangos ideales de una planta se
  leyeron por primera vez o cambiaron en OpenPlantBook. Elija opcionalmente la
  planta. Las acciones siguientes pueden usar
  `{{triggerEvent.data.plant_name}}`, `{{triggerEvent.data.min_soil_moisture}}`,
  `{{triggerEvent.data.max_temperature}}` y los demás umbrales.
- **Fallo de sincronización OpenPlantBook**: la lectura de OpenPlantBook empezó
  a fallar (credenciales rechazadas, cuota alcanzada, identificador de planta
  desconocido, servicio inaccesible). Un evento por avería, no uno por
  intento. Variables: `reason` y `error`.

### Acciones

- **Comprobar las condiciones de una planta**: compara mediciones con los
  rangos ideales de una planta. Rellene solo las mediciones que tenga; cada
  campo acepta un valor o una variable de escena, por ejemplo el resultado de
  una acción anterior «Obtener el último valor de un dispositivo». La
  temperatura está en la unidad configurada. Devuelve:
  - `in_range`: verdadero cuando todas las mediciones están en su rango ideal;
  - `status`: `ok`, `too_dry` (demasiado seco), `too_wet` (demasiado húmedo),
    `too_cold` (demasiado frío), `too_hot` (demasiado calor), `too_dark` (poca
    luz), `too_bright` (demasiada luz), `air_too_dry` (aire seco),
    `air_too_humid` (aire húmedo) o `no_data` (ninguna medición);
  - `issues_count`: el número de mediciones fuera de rango;
  - `message`: una frase lista para enviar, p. ej. «Monstera: suelo demasiado
    seco (8 %, mín. 15 %).»
- **Obtener los rangos ideales de una planta**: expone el nombre, el nombre
  científico, la categoría y todos los umbrales de una planta a las acciones
  siguientes.
- **Actualizar los datos de OpenPlantBook**: vuelve a leer todas las plantas
  ahora.

### Ejemplo: notificación «riégame»

1. Disparador: todos los días a las 18 h.
2. Acción: obtener el último valor de su sensor de humedad del suelo.
3. Acción **Comprobar las condiciones de una planta**: elija la planta y ponga
   la variable del paso anterior en **Humedad del suelo**.
4. Condición: `in_range` es falso.
5. Acción: enviar un mensaje con la salida `message`.

## Panel

- **Ficha de planta**: la foto y los cuatro rangos ideales de la planta elegida
  en los ajustes del widget, con un botón **Actualizar**.
- **Mis plantas**: todas las plantas seguidas con su foto; toque una planta
  para ver sus rangos. Un botón **Actualizar todo** vuelve a leerlo todo.

## Solución de problemas

- _«OpenPlantBook rechazó las credenciales»_: genere una nueva clave en la
  página API keys y vuelva a pegar ambos valores.
- _Una planta sigue sin datos_: compruebe su identificador con **Buscar una
  planta**; es el nombre científico en minúsculas.
- _«Too many requests»_: la API gratuita está limitada. Reduzca el número de
  plantas o aumente el intervalo de actualización.
- La integración registra todo lo que hace: consulte sus registros desde la
  interfaz de Gladys, con `LOG_LEVEL=debug` para el detalle completo. Los
  secretos nunca se registran.

Los datos y fotos de las plantas provienen de Open Plantbook
(https://open.plantbook.io/), un proyecto comunitario.
