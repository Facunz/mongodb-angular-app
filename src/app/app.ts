// Importaciones necesarias de Angular y cliente de Supabase
import { Component, signal, effect, computed, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
// RouterOutlet removed because this simple app doesn't use routing in the template
import { CommonModule } from '@angular/common'; // Para usar directivas como *ngFor, *ngIf en el template
import { supabase } from './supabase.client'; // Cliente configurado para conectar con Supabase

// Tipo que define la estructura de una escuela
type Escuela = { id: number; name: string }; // TypeScript nos ayuda a tener tipos seguros

// Configuración del componente Angular con selector, imports y archivos de template/estilos
@Component({
  selector: 'app-root', // Nombre del tag HTML que representa este componente
  imports: [CommonModule], // Módulos que necesita este componente standalone
  templateUrl: './app.html', // Archivo HTML del template
  styleUrl: './app.css', // Archivo CSS de estilos específicos
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  // Título de la aplicación usando signal reactivo
  protected readonly title = signal('Gestión de Escuelas'); // 'protected' permite acceso desde el template

  // Signal que almacena la lista de escuelas
  items = signal<Escuela[]>([]); // Los signals son reactivos - cuando cambian, el UI se actualiza automáticamente
  // Signal que indica si está cargando datos
  loading = signal(false); // Útil para mostrar spinners o desactivar botones

  // Signal para el nombre de la nueva escuela a crear
  newName = signal(''); // Two-way binding con el input del formulario

  // Referencia al canal de tiempo real de Supabase
  private realtimeChannel: any = null; // 'any' porque el tipo exacto es complejo
  // (hooks simplificados: sin timers ni manipulación del DOM)

  // Constructor que inicializa el componente
  constructor() {
    // Carga inicial de datos desde la base de datos
    void this.loadItems(); // 'void' ignora la promesa - no necesitamos esperar el resultado aquí
    // Configura las actualizaciones en tiempo real
    this.setupRealtime(); // Se ejecuta en paralelo con loadItems()
  }

  // ...existing code...
  // Configura la suscripción a cambios en tiempo real de la tabla 'escuela'
  // Subscribirse a cambios en la tabla 'escuela' y actualizar 
  // el estado local
  setupRealtime() {
    try {
      // Crea un canal para escuchar cambios en la tabla 'escuela'
      this.realtimeChannel = supabase
        .channel('public:escuela') // Nombre único del canal
        .on(
          'postgres_changes', // Tipo de evento de PostgreSQL
          { event: '*', schema: 'public', table: 'escuela' }, // Escucha TODOS los eventos (*) de la tabla
          (payload: any) => { // Función que se ejecuta cuando hay cambios
            console.log('📡 Realtime event received:', payload);
            const eventType = payload.eventType; // INSERT, UPDATE, DELETE

            // Manejo de evento INSERT - cuando se agrega un nuevo registro
            if (eventType === 'INSERT') {
              const newRow = payload.new; // Los datos del registro insertado
              console.log('➕ INSERT:', newRow);
              if (newRow) {
                // Actualiza el signal agregando el nuevo elemento si no existe
                this.items.update((arr) => { // update() modifica el signal de forma inmutable
                  const exists = arr.find(item => item.id === newRow.id); // Evita duplicados
                  if (!exists) {
                    return [...arr, newRow].sort((a, b) => a.id - b.id); // Spread operator + ordenamiento
                  }
                  return arr; // Si ya existe, no hace nada
                });
              }
            }
            // Manejo de evento UPDATE - cuando se modifica un registro existente
            if (eventType === 'UPDATE') {
              const updatedRow = payload.new; // Los datos actualizados del registro
              console.log('✏️ UPDATE:', updatedRow);
              if (updatedRow) {
                // Actualiza el elemento modificado en la lista
                this.items.update((arr) =>
                  arr.map((item) => item.id === updatedRow.id ? updatedRow : item) // Reemplaza solo el elemento modificado
                );
              }
            }

            // Manejo de evento DELETE - cuando se elimina un registro
            if (eventType === 'DELETE') {
              const deletedRow = payload.old; // Los datos del registro eliminado (antes de ser borrado)
              console.log('🗑️ DELETE:', deletedRow);
              if (deletedRow) {
                // Remueve el elemento eliminado de la lista
                this.items.update((arr) => arr.filter((item) => item.id !== deletedRow.id)); // filter() crea un nuevo array sin el elemento
              }
            }
          }
        )
        // Se suscribe al canal y maneja el estado de conexión
        .subscribe((status: any) => { // subscribe() activa la suscripción
          console.log('🔌 Realtime status:', status); // Estados: SUBSCRIBED, CLOSED, etc.
        });
    } catch (err) {
      console.error('❌ Realtime setup failed:', err);
    }
  }

  // Carga todas las escuelas desde la base de datos
  async loadItems() {
    this.loading.set(true); // Activa indicador de carga
    // Consulta todos los registros de la tabla 'escuela' ordenados por ID
    const { data, error } = await supabase.from('escuela').select('*').order('id', { ascending: true }); // Destructuring de la respuesta
    if (error) {
      console.error('Supabase select error', error);
      this.items.set([]); // Limpia la lista en caso de error
    } else {
      this.items.set((data as Escuela[]) || []); // 'as' hace type casting - le dice a TypeScript que trate data como Escuela[]
    }
    this.loading.set(false); // Desactiva indicador de carga
  }

  // Agrega una nueva escuela a la base de datos
  async addItem() {
    const name = this.newName();
    if (!name) return; // Guard clause - salida temprana si no hay nombre

    const payload = { name }; // Objeto con los datos a insertar
    // Inserta el nuevo registro y retorna los datos insertados
    const { data, error } = await supabase.from('escuela').insert(payload).select(); // .select() hace que retorne el registro insertado
    if (error) {
      console.error('insert error', error);
      return;
    }
    // Agrega el nuevo elemento al estado local
    this.items.update((arr) => [...arr, ...(data as Escuela[])]); // Spread operator para combinar arrays
    this.newName.set(''); // Limpia el campo de entrada
  }

  // Elimina una escuela de la base de datos por su ID
  async deleteItem(id: number) {
    // Ejecuta la eliminación en la base de datos
    const { error } = await supabase.from('escuela').delete().eq('id', id); // .eq() significa "equal" - WHERE id = ?
    if (error) {
      console.error('delete error', error);
      return;
    }
    // Remueve el elemento del estado local
    this.items.update((arr) => arr.filter((i) => i.id !== id)); // Filtra todos los elementos excepto el que tiene este ID
  }

  // Actualiza parcialmente una escuela existente (edición en línea)
  async updateItem(id: number, patch: Partial<Escuela>) { // Partial<T> significa que todas las propiedades son opcionales
    // Ejecuta la actualización en la base de datos y retorna los datos actualizados
    const { data, error } = await supabase.from('escuela').update(patch).eq('id', id).select(); // update() + eq() + select()

    if (error) {
      console.error('update error', error);
      return;
    }
    // Actualiza el elemento en el estado local si la operación fue exitosa
    if (data && data.length) { // Verifica que hay datos y no está vacío
      const updated = data[0] as Escuela; // Toma el primer elemento del array
      this.items.update((arr) => arr.map((it) => (it.id === id ? updated : it))); // Operador ternario: si el ID coincide, usa updated, sino mantiene it
    }
  }

  // Limpia la suscripción de tiempo real cuando el componente se destruye
  ngOnDestroy(): void {
    // Limpieza final: canales y timers
    try {
      if (this.realtimeChannel) {
        supabase.removeChannel(this.realtimeChannel);
        this.realtimeChannel = null;
      }
    } catch (err) {
      console.warn('Failed to remove realtime channel', err);
    }

  console.log('🗑️ ngOnDestroy: limpieza completa');
  }

  // ------------------------------------------------------------------
  // Hooks movidos al final con ejemplos llamativos
  // ------------------------------------------------------------------
  ngOnInit(): void {
    // Hook mínimo: inicializaciones ligeras
    console.log('ngOnInit');
  }

  ngAfterViewInit(): void {
    // Hook mínimo: post-render
    console.log('ngAfterViewInit');
  }
}


/*
Actividad: Ampliación de la base de datos y uso de nuevos campos

Objetivo: agregar 5 campos nuevos a la tabla escuela y usarlos en la app Angular con Supabase.

1) Agregar campos en Supabase:

direccion (texto), localidad (texto), telefono (texto), email (texto), fecha_fundacion (fecha).

2) Actualizar la app Angular:

Extender el modelo escuela con los 5 campos.

Modificar formulario de alta/edición para capturarlos.

Mostrar en la lista name, localidad, telefono y en detalles los demás.

Probar realtime:

Abrir dos pestañas y verificar que INSERT/UPDATE/DELETE se reflejen en ambas.

Entregar:

Captura de tabla en Supabase, capturas del formulario y de la lista funcionando, y un breve comentario sobre la experiencia.
*/