import {type Request, type Response, type NextFunction} from 'express';
import {AuthError} from "./OidcMiddleware.js";

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {

  if (err instanceof AuthError) {
    console.error(`Feil i autentisering: ${err.message}:`, err.originalError);
    res.status(500)
      .contentType('text/html')
      .send(`
        <p>Beklager, det skjedde en feil under innloggingen. Prøv igjen senere</p>
        <p>
            <a href="/auth/logout">Logg ut</a>
        </p>
      `)
  } else {
    console.error('Ukjent feil:', err);
    res.status(500).send('Beklager, det skjedde en feil. Prøv igjen senere.');
  }
}