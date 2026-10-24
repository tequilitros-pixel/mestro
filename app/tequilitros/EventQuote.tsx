"use client";

import { useMemo, useState } from "react";
import styles from "./quote.module.css";

const services = [
  "Barra Libre ($90 MXN / persona · servicio de 4 horas)",
  "Barra a Consumo ($250 MXN / hora de atención + producto consumido)",
  "Botellas de Tequila para Centros de Mesa",
  "Solicitar Degustación Gratuita previa",
  "Quiero asesoría para elegir la mejor opción",
];

const drinks = [
  "Vampiro",
  "Cantarito",
  "Paloma",
  "Tequimiche",
  "Tequimora",
  "Tequimojito",
  "Coscorrón",
  "Botellas de Tequila Blanco/Reposado",
];

export default function EventQuote() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [eventType, setEventType] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [guests, setGuests] = useState("150");
  const [duration, setDuration] = useState("4 horas");
  const [service, setService] = useState(services[0]);
  const [selected, setSelected] = useState<string[]>(["Cantarito", "Paloma", "Vampiro"]);
  const [notes, setNotes] = useState("");

  const message = useMemo(() => [
    "Hola, quiero cotizar la barra de Tequilitros para mi evento:",
    "• Nombre: " + name.trim(),
    "• Teléfono: " + phone.trim(),
    "• Tipo de evento: " + eventType,
    "• Fecha: " + date,
    "• Ubicación: " + location.trim(),
    "• Asistentes estimados: " + guests + " personas",
    "• Duración deseada: " + duration,
    "• Modalidad solicitada: " + service,
    "• Bebidas de interés: " + (selected.join(", ") || "Por definir"),
    "• Comentarios: " + (notes.trim() || "Ninguno"),
    "¿Podrían confirmarme disponibilidad y presupuesto final?"
  ].join("\n"), [name, phone, eventType, date, location, guests, duration, service, selected, notes]);

  const valid = name.trim().length >= 2 && /^\+?[\d\s()-]{10,20}$/.test(phone.trim()) && Boolean(eventType && date && location.trim().length >= 3 && guests && Number(guests) >= 40);
  const today = new Date();
  const localDate = [today.getFullYear(), String(today.getMonth()+1).padStart(2,"0"), String(today.getDate()).padStart(2,"0")].join("-");

  function toggleDrink(drink: string) {
    setSelected(previous => previous.includes(drink) ? previous.filter(v => v !== drink) : [...previous, drink]);
  }

  return (
    <section className={styles.section} id="cotizar" aria-labelledby="quote-title">
      <div className={styles.heading}>
        <p className={styles.eyebrow}>PASO FINAL · COTIZACIÓN DIRECTA</p>
        <h2 id="quote-title">Reserva tu Barra Móvil en <em>Minutos.</em></h2>
        <p>
          Comparte los datos de tu evento. Te respondemos de inmediato por WhatsApp con tu
          presupuesto desglosado, viáticos exactos y disponibilidad de fecha.
        </p>
        <div className={styles.trust}>
          <span>01 · Sin letras chiquitas</span>
          <span>02 · Anticipo del 50%</span>
          <span>03 · Degustación Gratuita disponible</span>
        </div>
      </div>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (valid)
            window.open(
              "https://wa.me/525662989202?text=" + encodeURIComponent(message),
              "_blank",
              "noopener,noreferrer"
            );
        }}
      >
        <div className={styles.formHeader}>
          <span>DATOS DE TU EVENTO</span>
          <span>Atendemos desde 40 personas</span>
        </div>
        <div className={styles.fields}>
          <label>
            Tu nombre *
            <input
              autoComplete="name"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="¿Cómo te llamas?"
            />
          </label>
          <label>
            Teléfono / WhatsApp *
            <input
              autoComplete="tel"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10 dígitos"
            />
          </label>
          <label>
            Tipo de evento *
            <select
              required
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              <option value="">Selecciona una opción</option>
              {[
                "Boda",
                "XV años",
                "Cumpleaños",
                "Graduación",
                "Evento empresarial",
                "Fiesta privada",
                "Bautizo / Primera Comunión",
                "Otro evento",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Fecha del evento *
            <input
              type="date"
              required
              min={localDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className={styles.full}>
            ¿Dónde será tu evento? (Municipio y lugar) *
            <input
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej. Tlaltenango, Jerez, Colotlán, Fresnillo, Zacatecas..."
            />
          </label>
          <label>
            Número de invitados estimados *
            <input
              type="number"
              min={40}
              max={10000}
              required
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              placeholder="Min. 40 personas"
            />
          </label>
          <label>
            Duración estimada del servicio
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              <option value="4 horas">4 horas (Servicio estándar)</option>
              <option value="5 horas">5 horas</option>
              <option value="6 horas">6 horas o más</option>
              <option value="Por definir">Por definir con asesor</option>
            </select>
          </label>
          <label className={styles.full}>
            Modalidad que te interesa *
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
            >
              {services.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className={styles.choices}>
          <legend>¿Qué bebidas del menú oficial te gustaría incluir?</legend>
          <div>
            {drinks.map((drink) => (
              <label
                key={drink}
                className={selected.includes(drink) ? styles.selected : ""}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(drink)}
                  onChange={() => toggleDrink(drink)}
                />
                <span>{drink}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className={styles.notes}>
          Comentarios o requerimientos adicionales
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Horario de llegada, si ocupas degustación previa, tipo de salón o hacienda..."
            maxLength={1000}
          />
        </label>
        <p className={styles.notice}>
          ⚡ Al enviar, se abrirá tu WhatsApp con el mensaje prellenado para recibir tu
          propuesta en minutos. No pedimos anticipos aquí; todo se acuerda formalmente por escrito.
        </p>
        <button type="submit" className={styles.submit} disabled={!valid}>
          Enviar cotización por WhatsApp (56 6298 9202) <span aria-hidden="true">↗</span>
        </button>
        <p className={styles.privacy}>
          Al enviar, aceptas ser contactado por Tequilitros Eventos. Consulta nuestro{" "}
          <a href="/privacy-policy">aviso de privacidad</a>.
        </p>
      </form>
    </section>
  );
}
