import Court from '../models/Court.js';

// Obtener todas las canchas
const getAllCourts = async () => {
  return await Court.findAll();
};

// Obtener canchas por club
const getCourtsByClub = async (clubId) => {
  return await Court.findAll({
    where: { clubId },
    include: [
      {
        association: 'club'
      }
    ]
  });
};

// Obtener una cancha por ID
const getCourtById = async (id) => {
  return await Court.findByPk(id);
};

// Crear una nueva cancha
const createCourt = async (courtData) => {
  return await Court.create(courtData);
};

// Actualizar una cancha
const updateCourt = async (id, updateData) => {
  const court = await Court.findByPk(id);
  if (!court) throw new Error('Cancha no encontrada');
  return await court.update(updateData);
};

// Eliminar una cancha
const deleteCourt = async (id) => {
  const court = await Court.findByPk(id);
  if (!court) throw new Error('Cancha no encontrada');
  return await court.destroy();
};

export {
  getAllCourts,
  getCourtsByClub,
  getCourtById,
  createCourt,
  updateCourt,
  deleteCourt
};