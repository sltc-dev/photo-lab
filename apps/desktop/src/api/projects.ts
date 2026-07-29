import {
  createProject,
  getProject,
  listProjects,
  type CreateProjectDto,
  type ProjectDto,
} from '../generated/api';

export const projectsQueryKey = ['projects'] as const;
export const projectQueryKey = (projectId: string) => ['projects', projectId] as const;

export async function getProjects(): Promise<ProjectDto[]> {
  const response = await listProjects({
    throwOnError: true,
  });

  return response.data;
}

export async function addProject(input: CreateProjectDto): Promise<ProjectDto> {
  const response = await createProject({
    body: input,
    throwOnError: true,
  });

  return response.data;
}

export async function getProjectById(projectId: string): Promise<ProjectDto> {
  const response = await getProject({
    path: {
      projectId,
    },
    throwOnError: true,
  });

  return response.data;
}
