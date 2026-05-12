import { Injectable, NgZone } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Ensures all HTTP response callbacks run inside Angular's NgZone so that
 * Change Detection is triggered reliably, regardless of zone.js XHR patching.
 */
@Injectable()
export class ZoneInterceptor implements HttpInterceptor {
  constructor(private readonly ngZone: NgZone) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return new Observable(observer => {
      const sub = next.handle(req).subscribe({
        next:     event => this.ngZone.run(() => observer.next(event)),
        error:    err   => this.ngZone.run(() => observer.error(err)),
        complete: ()    => this.ngZone.run(() => observer.complete()),
      });
      return () => sub.unsubscribe();
    });
  }
}
