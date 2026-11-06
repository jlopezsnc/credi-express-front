import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '@/core/auth/auth.service';
import {
  borrarActividad,
  INACTIVIDAD_MAXIMA_MS,
  leerUltimaActividad,
  motivoDeCierre,
  registrarActividad,
  SESION_MAXIMA_MS,
} from '@/core/auth/sesion';
import { SesionService } from '@/core/auth/sesion.service';

const AHORA = Date.parse('2026-11-05T20:00:00Z');
const MINUTO = 60_000;

describe('motivoDeCierre', () => {
  it('no cierra mientras haya actividad reciente y la sesión sea joven', () => {
    expect(motivoDeCierre(AHORA, AHORA - 14 * MINUTO, AHORA - 11 * 60 * MINUTO)).toBeUndefined();
  });

  it('cierra a los 15 minutos sin actividad', () => {
    expect(motivoDeCierre(AHORA, AHORA - INACTIVIDAD_MAXIMA_MS, null)).toBe('inactividad');
  });

  it('cierra a las 12 horas aunque se esté usando', () => {
    expect(motivoDeCierre(AHORA, AHORA, AHORA - SESION_MAXIMA_MS)).toBe('vencida');
  });

  it('si no se conoce el inicio de sesión solo cuenta la inactividad', () => {
    expect(motivoDeCierre(AHORA, AHORA, null)).toBeUndefined();
  });
});

describe('SesionService', () => {
  const cerrarSesion = vi.fn(() => Promise.resolve());
  const navigate = vi.fn(() => Promise.resolve(true));
  const inicioSesion = signal<number | null>(null);
  let dejarDeVigilar: () => void = () => undefined;

  function vigilar(): void {
    dejarDeVigilar = TestBed.inject(SesionService).vigilar();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    borrarActividad();
    cerrarSesion.mockClear();
    navigate.mockClear();
    inicioSesion.set(AHORA - MINUTO);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { cerrarSesion, inicioSesion } },
        { provide: Router, useValue: { url: '/cobranza', navigate } },
      ],
    });
  });

  afterEach(() => {
    dejarDeVigilar();
    borrarActividad();
    vi.useRealTimers();
  });

  it('cierra la sesión tras 15 minutos sin actividad y regresa al login con el motivo', async () => {
    vigilar();

    await vi.advanceTimersByTimeAsync(INACTIVIDAD_MAXIMA_MS + 15_000);

    expect(cerrarSesion).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { motivo: 'inactividad', desde: '/cobranza' },
      replaceUrl: true,
    });
  });

  it('la actividad reinicia la cuenta', async () => {
    vigilar();

    await vi.advanceTimersByTimeAsync(10 * MINUTO);
    document.dispatchEvent(new Event('keydown'));
    await vi.advanceTimersByTimeAsync(10 * MINUTO);

    expect(cerrarSesion).not.toHaveBeenCalled();
    expect(leerUltimaActividad()).toBe(AHORA + 10 * MINUTO);
  });

  it('volver a una pestaña olvidada no revive la sesión', async () => {
    registrarActividad(AHORA - 20 * MINUTO);

    vigilar();
    await vi.advanceTimersByTimeAsync(0);

    expect(cerrarSesion).toHaveBeenCalledTimes(1);
  });

  it('cierra a las 12 horas aunque haya actividad', async () => {
    inicioSesion.set(AHORA - SESION_MAXIMA_MS + MINUTO);
    vigilar();

    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(30_000);
      document.dispatchEvent(new Event('pointerdown'));
    }

    expect(cerrarSesion).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { motivo: 'vencida', desde: '/cobranza' },
      replaceUrl: true,
    });
  });

  it('al dejar de vigilar ya no cierra nada', async () => {
    vigilar();
    dejarDeVigilar();

    await vi.advanceTimersByTimeAsync(INACTIVIDAD_MAXIMA_MS + 15_000);

    expect(cerrarSesion).not.toHaveBeenCalled();
  });
});
