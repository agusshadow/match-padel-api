import Club from '../models/Club.js';

// Obtener todos los clubes
const getAllClubs = async () => {
  return await Club.findAll();
};

// Obtener un club por ID
const getClubById = async (id) => {
  return await Club.findByPk(id);
};

// Crear un nuevo club
const createClub = async (clubData) => {
  return await Club.create(clubData);
};

// Actualizar un club
const updateClub = async (id, updateData) => {
  const club = await Club.findByPk(id);
  if (!club) throw new Error('Club no encontrado');
  return await club.update(updateData);
};

// Eliminar un club
const deleteClub = async (id) => {
  const club = await Club.findByPk(id);
  if (!club) throw new Error('Club no encontrado');
  return await club.destroy();
};

export {
  getAllClubs,
  getClubById,
  createClub,
  updateClub,
  deleteClub
};