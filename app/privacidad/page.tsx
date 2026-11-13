import type { Metadata } from 'next'
import { SiteNav, SiteFooter } from '../_landing/Landing'
import { outfit } from '../_landing/font'

export const metadata: Metadata = {
  title: 'Aviso de privacidad · Winflow',
  description: 'Cómo trata Winflow los datos de las agencias, de sus prospectos y de quienes solicitan el piloto.',
}

export default function Privacidad() {
  return (
    <div className={outfit.variable}>
    <div className="lp">
      <SiteNav simple />
      <main>
        <article className="lp-legal">
          <h1>Aviso de privacidad</h1>
          <p className="lp-note">Versión del piloto · actualizado el 11 de noviembre de 2026</p>

          <h2>Quién somos</h2>
          <p>Winflow, operado por Kevin Loyo Díaz, Lisboa, Portugal. Contacto de privacidad: <a href="mailto:privacidad@winflowapp.com">privacidad@winflowapp.com</a>.</p>
          <p>Winflow es <strong>responsable</strong> de los datos de las personas que usan una cuenta y de quienes solicitan el piloto. Respecto de los datos de prospectos que una agencia carga, Winflow actúa como <strong>encargado</strong> y la agencia es la responsable.</p>

          <h2>Qué datos tratamos</h2>
          <ul>
            <li>De quien solicita el piloto: nombre, nombre de la agencia, correo, sitio web, tamaño del equipo, cómo registra sus llamadas y el mensaje que decida escribir.</li>
            <li>De los usuarios de la agencia: correo, nombre, rol y actividad dentro de la plataforma.</li>
            <li>De los prospectos que la agencia captura: nombre, cargo, empresa, correo, sitio web, notas de llamadas, presupuesto y fechas.</li>
            <li>De quien abre una propuesta compartida por enlace: que la abrió, cuántas veces y cuándo, y si la aceptó.</li>
          </ul>

          <h2>Para qué los usamos</h2>
          <p>Contactarte sobre el piloto; generar propuestas personalizadas, enviarlas y darles seguimiento (incluidos recordatorios automáticos que la agencia puede activar o pausar); mostrar a la agencia si fueron vistas o aceptadas, y mantener la seguridad del servicio. No vendemos datos ni los usamos para publicidad.</p>

          <h2>Con quién los compartimos</h2>
          <p>Con proveedores que procesan datos por nuestra cuenta: Supabase (base de datos y autenticación), Vercel (alojamiento), n8n Cloud (orquestación), Anthropic (modelo de IA que redacta el contenido), Jina (lectura del sitio web que la agencia indica), Brandfetch (logotipo y colores de la empresa), PDFShift (conversión a PDF) y Google Workspace (correo de Winflow). Estos proveedores pueden estar fuera de México y de la Unión Europea.</p>

          <h2>Cómo funciona la IA</h2>
          <p>El contenido de las propuestas y de los seguimientos lo genera un modelo de IA a partir de lo que la agencia captura y, si se indica, del sitio web del prospecto. La agencia debe revisar cada propuesta antes de enviarla. Los nombres de los clientes de la agencia usados como casos de éxito se sustituyen por una etiqueta anónima. Cada seguimiento incluye una línea para que el destinatario pida no recibir más mensajes.</p>

          <h2>Conservación</h2>
          <p>Mientras la cuenta esté activa y hasta 90 días después de cancelarla; después se borran o anonimizan. Las solicitudes de piloto que no avancen se pueden borrar cuando lo pidas. Podemos conservar estadísticas agregadas y anónimas para mejorar el servicio.</p>

          <h2>Tus derechos</h2>
          <p>Acceso, rectificación, cancelación o supresión, oposición y portabilidad, escribiendo a <a href="mailto:privacidad@winflowapp.com">privacidad@winflowapp.com</a>. Si eres prospecto de una agencia, escríbele primero a esa agencia, que es la responsable de tus datos; nosotros le ayudamos a atender tu solicitud.</p>

          <h2>Cambios</h2>
          <p>Publicaremos aquí cualquier actualización con su fecha.</p>
        </article>
      </main>
      <SiteFooter />
    </div>
    </div>
  )
}
