# Base de Dados Geográficos dos Parques

Este diretório armazena os dados geográficos de referência dos parques utilizados no projeto **Viva**.

Seu objetivo é centralizar os arquivos obtidos por meio do OpenStreetMap (OSM) e suas respectivas versões em GeoJSON, facilitando a consulta, a organização, a manutenção e a atualização das informações geográficas dos parques.

## Formatos de Arquivo

### OSM (.osm)

Arquivos originais exportados do OpenStreetMap.

São mantidos como fonte de referência para preservar os dados geográficos obtidos durante a consulta ou exportação.

Podem conter informações como:
- Pontos de interesse;
- Vias e caminhos;
- Limites e áreas;
- Elementos geográficos associados ao parque.

### GeoJSON (.geojson)

Arquivos utilizados como referência geográfica durante o desenvolvimento do projeto.

Esse formato permite representar diferentes tipos de geometrias, como:
- Point;
- LineString;
- Polygon;
- MultiPolygon.

No Viva, os dados GeoJSON podem auxiliar na definição de limites geográficos, visualização de áreas e configuração dos mapas dos parques.

## Finalidade no Projeto Viva

Os arquivos deste diretório possuem finalidade de referência e apoio ao desenvolvimento.

Eles auxiliam na:
- Criação e atualização dos dados geográficos dos parques;
- Identificação de limites e áreas de interesse;
- Consulta de coordenadas e elementos geográficos;
- Preparação dos dados utilizados pelos recursos de mapas do aplicativo.

**Importante:** os arquivos armazenados neste diretório não são necessariamente consumidos diretamente pela aplicação. Os dados efetivamente utilizados pelo Viva devem ser preparados e organizados nos arquivos próprios do catálogo da aplicação.

## Fonte dos Dados

Os dados geográficos são obtidos a partir do [OpenStreetMap](https://www.openstreetmap.org/).

O OpenStreetMap é um projeto colaborativo de mapeamento, cujos dados são disponibilizados sob a licença Open Database License (ODbL).

Ao utilizar ou redistribuir esses dados, é necessário observar os termos da licença e fornecer os devidos créditos:

**© OpenStreetMap contributors**

Mais informações:
- [OpenStreetMap](https://www.openstreetmap.org/)
- [Copyright e Licença](https://www.openstreetmap.org/copyright)

## Observações

- Manter os arquivos originais `.osm` sempre que possível.
- Atualizar os arquivos GeoJSON quando houver alterações nos dados geográficos.
- Evitar alterações desnecessárias nos arquivos originais exportados.
- Verificar a precisão dos limites geográficos antes de utilizá-los em funcionalidades do aplicativo.

---

**Projeto:** Viva – Aplicativo de atividades e bem-estar em parques de Manaus.

**Diretório:** `data/parques/`
