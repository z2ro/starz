import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from '../frontend/src/components/ui/Badge';
import { DataRow } from '../frontend/src/components/ui/DataRow';
import { HUDMetric } from '../frontend/src/components/ui/HUDMetric';
import { Inspector, InspectorSection } from '../frontend/src/components/ui/Inspector';
import { OperationsColumn, OperationsDeck, QueueItem } from '../frontend/src/components/ui/OperationsDeck';
import { Panel } from '../frontend/src/components/ui/Panel';
import { Progress } from '../frontend/src/components/ui/Progress';

describe('Imperial Command UI foundation', () => {
  it('renders semantic metrics, states and accessible progress', () => {
    render(<><HUDMetric icon="energy" label="Energia" value="14 / 20" detail="+6 margem" tone="positive" /><Badge tone="warning">ATENÇÃO</Badge><Progress value={58} text="58% concluído" tone="research" /><DataRow label="Coordenadas" value="0:1" /></>);
    expect(screen.getByText('Energia')).toBeInTheDocument();
    expect(screen.getByText('ATENÇÃO')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '58');
    expect(screen.getByText('Coordenadas')).toBeInTheDocument();
  });

  it('composes panel, reusable inspector and continuous operations deck', () => {
    render(<><Panel title="Estado" eyebrow="COMANDO">Conteúdo real</Panel><Inspector label="Inspector de teste" state="warning" header={<div>Header</div>} summary={<div>Resumo</div>}><InspectorSection title="Dados"><DataRow label="Status" value="Estável" /></InspectorSection></Inspector><OperationsDeck><OperationsColumn icon="operations" title="Construção" count={1}><QueueItem title="Obra atual" meta="Infraestrutura" progress={50} eta="2 min" status="ATIVA" /></OperationsColumn><OperationsColumn icon="research" title="Pesquisa"><div>Sem pesquisa</div></OperationsColumn></OperationsDeck></>);
    expect(screen.getByText('Estado')).toBeInTheDocument();
    expect(screen.getByLabelText('Inspector de teste')).toBeInTheDocument();
    expect(screen.getByLabelText('Inspector de teste')).toHaveAttribute('data-state', 'warning');
    expect(screen.getByLabelText('Operações ativas')).toBeInTheDocument();
    expect(screen.getByText('Obra atual')).toBeInTheDocument();
  });
});
