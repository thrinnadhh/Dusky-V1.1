package `in`.dusky.foundation

import org.hamcrest.Matchers.equalTo
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FoundationApplicationTest(@param:Autowired private val mockMvc: MockMvc) {
    @Test
    fun `test context starts and health readiness is exposed`() {
        mockMvc.get("/actuator/health").andExpect { status { isOk() }; jsonPath("$.status", equalTo("UP")) }
        mockMvc.get("/actuator/health/readiness").andExpect { status { isOk() }; jsonPath("$.status", equalTo("UP")) }
    }

    @Test
    fun `standard error envelope carries code message and trace id`() {
        mockMvc.get("/api/foundation/error")
            .andExpect {
                status { isBadRequest() }
                jsonPath("$.error.code", equalTo("VALIDATION_ERROR"))
                jsonPath("$.error.message", equalTo("Foundation validation example"))
                jsonPath("$.error.traceId", equalTo("trace-test-fixed"))
            }
    }
}
