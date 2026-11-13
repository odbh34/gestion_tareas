const express = require('express');
const authenticate = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const tasksService = require('./tasks.service');
const {
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
  taskIdSchema,
} = require('./tasks.schemas');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  validate(listTasksQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await tasksService.listTasks(req.user, req.validated.query);
    res.status(200).json(result);
  }),
);

router.post(
  '/',
  validate(createTaskSchema),
  asyncHandler(async (req, res) => {
    const task = await tasksService.createTask(req.user, req.validated.body);
    res.status(201).json({ data: task });
  }),
);

router.get(
  '/:id',
  validate(taskIdSchema, 'params'),
  asyncHandler(async (req, res) => {
    const task = await tasksService.getTaskById(
      req.validated.params.id,
      req.user,
    );
    res.status(200).json({ data: task });
  }),
);

router.patch(
  '/:id',
  validate(taskIdSchema, 'params'),
  validate(updateTaskSchema),
  asyncHandler(async (req, res) => {
    const task = await tasksService.updateTask(
      req.validated.params.id,
      req.user,
      req.validated.body,
    );
    res.status(200).json({ data: task });
  }),
);

router.delete(
  '/:id',
  validate(taskIdSchema, 'params'),
  asyncHandler(async (req, res) => {
    await tasksService.deleteTask(req.validated.params.id, req.user);
    res.status(204).end();
  }),
);

module.exports = router;
