CREATE TABLE credenciales (usuarioId VARCHAR(100) PRIMARY KEY,passwordHash VARCHAR(255) NOT NULL,creadaEn VARCHAR(35) NOT NULL,FOREIGN KEY(usuarioId) REFERENCES usuarios(id)) ENGINE=InnoDB;
CREATE INDEX idx_reservas_cliente_estado ON reservas(clienteId,estado);
CREATE INDEX idx_reservas_periodo ON reservas(desde,hasta);
CREATE INDEX idx_bloqueos_articulo_periodo ON bloqueos(articuloId,desde,hasta);
