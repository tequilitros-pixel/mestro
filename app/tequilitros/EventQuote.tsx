"use client";

import { useMemo, useState } from "react";
import styles from "./quote.module.css";

const services = ["Barra móvil con preparación", "Bebidas para evento", "Servicio de coctelería", "Quiero asesoría para elegir"];
const drinks = ["Cantarito", "Paloma", "Vampiro", "Tequimango", "Tequimiche", "Tequimora", "Otra bebida / por confirmar"];

export default function EventQuote() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [eventType, setEventType] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [guests, setGuests] = useState("");
  const [duration, setDuration] = useState("");
  const [service, setService] = useState(services[0]);
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const message = useMemo(() => [
    "Hola, quiero cotizar Tequilitros para mi evento.",
    "Nombre: " + name.trim(),
    "Teléfono: " + phone.trim(),
    "Tipo de evento: " + eventType,
    "Fecha: " + date,
    "Localidad y lugar: " + location.trim(),
    "Invitados estimados: " + guests,
    "Duración estimada: " + (duration || "Por definir"),
    "Servicio: " + service,
    "Bebidas: " + (selected.join(", ") || "Por recomendar"),
    "Comentarios: " + (notes.trim() || "Sin comentarios"),
    "Solicito confirmar disponibilidad, precios, traslado y viáticos antes de contratar."
  ].join("\n"), [name, phone, eventType, date, location, guests, duration, service, selected, notes]);

  const valid = name.trim().length >= 2 && /^\+?[\d\s()-]{10,20}$/.test(phone.trim()) && Boolean(eventType && date && location.trim().length >= 3 && guests && Number(guests) > 0);
  const today = new Date();
  const localDate = [today.getFullYear(), String(today.getMonth()+1).padStart(2,"0"), String(today.getDate()).padStart(2,"0")].join("-");

  function toggleDrink(drink: string) {
    setSelected(previous => previous.includes(drink) ? previous.filter(v => v !== drink) : [...previous, drink]);
  }

  return (
    <section className={styles.section} id="cotizar" aria-labelledby="quote-title">
      <div className={styles.heading}>
        <p className={styles.eyebrow}>TU EVENTO EMPIEZA AQUÍ · 08</p>
        <h2 id="quote-title">Hagamos algo <em>inolvidable.</em></h2>
        <p>Cuéntanos cómo será tu celebración. Preparamos tu solicitud y la enviamos directamente por WhatsApp, con todos los datos que necesitamos para darte una propuesta.</p>
        <div className={styles.trust}><span>01 · Sin compromiso</span><span>02 · Atención personalizada</span><span>03 · Viáticos claros</span></div>
      </div>
      <form className={styles.form} onSubmit={event => {event.preventDefault(); if (valid) window.open("https://wa.me/525662989202?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");}}>
        <div className={styles.formHeader}><span>DATOS DE TU EVENTO</span><span>Los campos * son obligatorios</span></div>
        <div className={styles.fields}>
          <label>Tu nombre *<input autoComplete="name" required minLength={2} value={name} onChange={e=>setName(e.target.value)} placeholder="¿Cómo te llamas?" /></label>
          <label>Teléfono / WhatsApp *<input autoComplete="tel" type="tel" required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="10 dígitos" /></label>
          <label>Tipo de evento *<select required value={eventType} onChange={e=>setEventType(e.target.value)}><option value="">Selecciona una opción</option>{["Boda", "XV años", "Cumpleaños", "Evento empresarial", "Fiesta privada", "Baile", "Otro"].map(v=><option key={v}>{v}</option>)}</select></label>
          <label>Fecha del evento *<input type="date" required min={localDate} value={date} onChange={e=>setDate(e.target.value)} /></label>
          <label className={styles.full}>¿Dónde será? *<input required value={location} onChange={e=>setLocation(e.target.value)} placeholder="Municipio, estado y lugar aproximado" /></label>
          <label>Invitados aproximados *<input type="number" min={1} max={100000} required value={guests} onChange={e=>setGuests(e.target.value)} placeholder="Ej. 150" /></label>
          <label>Duración estimada<select value={duration} onChange={e=>setDuration(e.target.value)}><option value="">Por definir</option>{["2 horas","3 horas","4 horas","5 horas","6 horas o más"].map(v=><option key={v}>{v}</option>)}</select></label>
          <label className={styles.full}>¿Qué servicio te interesa?<select value={service} onChange={e=>setService(e.target.value)}>{services.map(v=><option key={v}>{v}</option>)}</select></label>
        </div>
        <fieldset className={styles.choices}><legend>¿Qué bebidas te gustaría incluir?</legend><div>{drinks.map(drink=><label key={drink} className={selected.includes(drink)?styles.selected:""}><input type="checkbox" checked={selected.includes(drink)} onChange={()=>toggleDrink(drink)} /><span>{drink}</span></label>)}</div></fieldset>
        <label className={styles.notes}>Comentarios adicionales<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Horario, número de bebidas, paquete o cualquier detalle importante…" maxLength={1200}/></label>
        <p className={styles.notice}>El formulario prepara un mensaje para WhatsApp; no reserva automáticamente la fecha. Precios y viáticos se confirman al revisar distancia, personal y condiciones del evento. No solicitamos pagos aquí.</p>
        <button type="submit" className={styles.submit} disabled={!valid}>Enviar solicitud por WhatsApp <span aria-hidden="true">↗</span></button>
        <p className={styles.privacy}>Al enviar, eliges compartir estos datos con Tequilitros por WhatsApp. Consulta nuestro <a href="/privacy-policy">aviso de privacidad</a>.</p>
      </form>
    </section>
  );
}
