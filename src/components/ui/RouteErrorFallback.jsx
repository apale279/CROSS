import { Component } from 'react';

/** Mostra un errore invece della schermata bianca se un componente va in crash. */
export class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg p-6 text-center">
          <h1 className="text-lg font-bold text-red-800">Errore nel caricamento della pagina</h1>
          <pre className="mt-4 overflow-auto rounded bg-red-50 p-3 text-left text-xs text-red-900">
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <p className="mt-4 text-sm text-slate-600">
            Apri la console del browser (F12) per i dettagli e ricarica la pagina.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
