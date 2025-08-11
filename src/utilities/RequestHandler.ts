import express from 'express'

export type RequestHandler = (request: express.Request) => Promise<Response>

export interface Response {
  status: number,
  body?: any,
  rawBody?: boolean
  headers?: any,
}

type RequestHandlerParameters = Parameters<express.RequestHandler>
type RequestType = RequestHandlerParameters[0]
type ResponseType = RequestHandlerParameters[1]

export function useRequestHandler(requestHandler: RequestHandler):
  (request: RequestType, response: ResponseType) => Promise<void> {
  return async (request, response) => {
    const responseData = await requestHandler(request)

    Object.keys(responseData.headers || {}).forEach(key => {
      response.setHeader(key, responseData.headers[key])
    })

    response.status(responseData.status)
    responseData.body
      ? responseData.rawBody
        ? response.send(responseData.body)
        : response.json(responseData.body)
      : response.end()
  }
}
